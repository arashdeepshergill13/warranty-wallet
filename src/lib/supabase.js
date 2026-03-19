import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://somsokpuyvfjyptjlivc.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvbXNva3B1eXZmanlwdGpsaXZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3OTUyOTYsImV4cCI6MjA4OTM3MTI5Nn0.2D7PQLgPuPeffnaiNG-MrF0N_7CCy7vkjmmXXfWAjxw";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
