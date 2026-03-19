import { useState } from "react";
import { supabase } from "../lib/supabase";

export function useReceiptParser() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const parseReceipt = async (file) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const base64 = await fileToBase64(file);

      const { data, error: fnError } = await supabase.functions.invoke(
        "parse-receipt",
        { body: { image_base64: base64 } }
      );

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setResult(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { parseReceipt, loading, error, result };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
