import { supabase } from "./Supabase";

const upload = async (file) => {
  if (!file || !file.name) throw new Error("Invalid file");
  const path = `${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from("chat-images").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("chat-images").getPublicUrl(path);
  return data.publicUrl;
};

export default upload;
