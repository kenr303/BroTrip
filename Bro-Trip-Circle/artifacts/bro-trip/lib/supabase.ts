import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://gwjemmsqgvgpygvvqvfq.supabase.co/";
const supabaseKey = "sb_publishable_Ke5cGF5aTt-ACnG_5twcJA_WYw2paZL";

export const supabase = createClient(supabaseUrl, supabaseKey);