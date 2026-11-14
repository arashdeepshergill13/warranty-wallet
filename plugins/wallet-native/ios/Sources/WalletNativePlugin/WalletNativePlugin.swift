import Foundation
import UIKit
import AVFoundation
import Vision
import VisionKit
import LocalAuthentication
import Capacitor

/// The app's only custom native code. It uses frameworks that ship with iOS
/// and nothing else: the document scanner (VisionKit), text recognition
/// (Vision) and Face ID / Touch ID / passcode (LocalAuthentication).
/// All of it runs on the device. Nothing in this file touches the network.
@objc(WalletNativePlugin)
public class WalletNativePlugin: CAPPlugin, CAPBridgedPlugin, VNDocumentCameraViewControllerDelegate {
    public let identifier = "WalletNativePlugin"
    public let jsName = "WalletNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isScannerAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scanDocument", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognizeText", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "lockStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPrivacyScreen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise)
    ]

    private var scanCall: CAPPluginCall?
    private var maxPages = 3
    private var privacyEnabled = false
    private var privacyCover: UIView?

    override public func load() {
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(coverContents), name: UIApplication.willResignActiveNotification, object: nil)
        center.addObserver(self, selector: #selector(uncoverContents), name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Scanning

    @objc func isScannerAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": VNDocumentCameraViewController.isSupported])
    }

    @objc func scanDocument(_ call: CAPPluginCall) {
        guard VNDocumentCameraViewController.isSupported else {
            call.unavailable("Document scanning is not supported on this device.")
            return
        }
        let requestedPages = call.getInt("maxPages") ?? 3
        let present: () -> Void = { [weak self] in
            DispatchQueue.main.async {
                guard let self = self, let host = self.bridge?.viewController else {
                    call.reject("The scanner could not be opened.")
                    return
                }
                if self.scanCall != nil {
                    call.reject("A scan is already in progress.")
                    return
                }
                self.maxPages = max(1, min(requestedPages, 5))
                self.scanCall = call
                let scanner = VNDocumentCameraViewController()
                scanner.delegate = self
                host.present(scanner, animated: true)
            }
        }

        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            present()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                if granted {
                    present()
                } else {
                    call.reject("Camera access is off.", "CAMERA_DENIED")
                }
            }
        default:
            call.reject("Camera access is off.", "CAMERA_DENIED")
        }
    }

    public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
        let call = scanCall
        scanCall = nil
        var images: [UIImage] = []
        let count = min(scan.pageCount, maxPages)
        if count > 0 {
            for index in 0..<count {
                images.append(scan.imageOfPage(at: index))
            }
        }
        controller.dismiss(animated: true)

        DispatchQueue.global(qos: .userInitiated).async {
            var pages: [[String: Any]] = []
            for image in images {
                let prepared = WalletNativePlugin.resized(image, maxSide: 1800)
                guard let data = prepared.jpegData(compressionQuality: 0.72) else { continue }
                pages.append([
                    "image": data.base64EncodedString(),
                    "lines": WalletNativePlugin.recognize(prepared)
                ])
            }
            call?.resolve(["cancelled": false, "pages": pages])
        }
    }

    public func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
        let call = scanCall
        scanCall = nil
        controller.dismiss(animated: true)
        call?.resolve(["cancelled": true])
    }

    public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
        let call = scanCall
        scanCall = nil
        controller.dismiss(animated: true)
        call?.reject("The scan did not finish. Try again.", "SCAN_FAILED", error)
    }

    @objc func recognizeText(_ call: CAPPluginCall) {
        guard let encoded = call.getString("image"),
              let data = Data(base64Encoded: encoded, options: .ignoreUnknownCharacters),
              let image = UIImage(data: data) else {
            call.reject("That photo could not be read.")
            return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            let prepared = WalletNativePlugin.resized(image, maxSide: 2400)
            call.resolve(["lines": WalletNativePlugin.recognize(prepared)])
        }
    }

    /// Redraws the image upright at a sensible size. Receipts stay readable
    /// and the saved photo is a fraction of the size of a camera original.
    private static func resized(_ image: UIImage, maxSide: CGFloat) -> UIImage {
        let longest = max(image.size.width, image.size.height, 1)
        let scale = min(1, maxSide / longest)
        let size = CGSize(
            width: max(1, (image.size.width * scale).rounded()),
            height: max(1, (image.size.height * scale).rounded())
        )
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }

    /// On-device text recognition. Each line comes back with its position
    /// (0...1, origin top-left) so the app can pair item names with prices.
    private static func recognize(_ image: UIImage) -> [[String: Any]] {
        guard let cgImage = image.cgImage else { return [] }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up, options: [:])
        do {
            try handler.perform([request])
        } catch {
            return []
        }
        guard let observations = request.results else { return [] }
        var lines: [[String: Any]] = []
        for observation in observations {
            guard let best = observation.topCandidates(1).first else { continue }
            let box = observation.boundingBox
            lines.append([
                "text": best.string,
                "confidence": Double(best.confidence),
                "x": Double(box.minX),
                "y": Double(1 - box.maxY),
                "w": Double(box.width),
                "h": Double(box.height)
            ])
        }
        return lines
    }

    // MARK: - App lock

    @objc func lockStatus(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
        var kind = "none"
        if available {
            kind = "passcode"
            var biometryError: NSError?
            if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &biometryError) {
                switch context.biometryType {
                case .faceID:
                    kind = "faceID"
                case .touchID:
                    kind = "touchID"
                default:
                    kind = "passcode"
                }
            }
        }
        call.resolve(["available": available, "kind": kind])
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "Unlock your receipts"
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            call.resolve(["available": false, "success": false])
            return
        }
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, _ in
            call.resolve(["available": true, "success": success])
        }
    }

    // MARK: - Hide contents in the app switcher

    @objc func setPrivacyScreen(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        DispatchQueue.main.async {
            self.privacyEnabled = enabled
            if !enabled {
                self.uncoverContents()
            }
            call.resolve()
        }
    }

    @objc private func coverContents() {
        guard privacyEnabled, privacyCover == nil,
              let window = bridge?.viewController?.view.window else { return }
        let cover = UIView(frame: window.bounds)
        cover.backgroundColor = .systemBackground
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        window.addSubview(cover)
        privacyCover = cover
    }

    @objc private func uncoverContents() {
        privacyCover?.removeFromSuperview()
        privacyCover = nil
    }

    // MARK: - Settings

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
            call.resolve()
        }
    }
}
