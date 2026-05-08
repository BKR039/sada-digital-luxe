import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, Loader2, GripVertical } from "lucide-react";
import { SmartMedia, isVideoUrl } from "./SmartMedia";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";
const MAX_MB = 50;

async function uploadOne(file: File, folder: string): Promise<string> {
  if (file.size > MAX_MB * 1024 * 1024) throw new Error(`File too large (max ${MAX_MB}MB)`);
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return data.publicUrl;
}

interface SingleProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  label?: string;
  aspect?: string; // e.g. "aspect-video"
}

export function MediaUpload({ value, onChange, folder = "uploads", label = "Upload media", aspect = "aspect-video" }: SingleProps) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handle = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadOne(file, folder);
      onChange(url);
      toast.success("Uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handle(e.dataTransfer.files?.[0] || null); }}
        onClick={() => inputRef.current?.click()}
        className={`relative ${aspect} rounded-2xl glass border border-dashed border-primary/30 hover:border-primary cursor-pointer overflow-hidden group transition-all`}
      >
        {value ? (
          <>
            <SmartMedia src={value} fit="cover" className="w-full h-full" loading="eager" autoplay={false} />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="absolute top-2 right-2 size-8 grid place-items-center rounded-lg bg-black/70 hover:bg-destructive text-white"
            >
              <X className="size-4" />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-center p-4">
            {busy ? (
              <Loader2 className="size-6 animate-spin text-accent" />
            ) : (
              <div>
                <Upload className="size-6 mx-auto text-accent mb-2" />
                <div className="text-sm font-semibold">{label}</div>
                <div className="text-xs text-muted-foreground mt-1">Drop image or video · JPG, PNG, WEBP, MP4 (max {MAX_MB}MB)</div>
              </div>
            )}
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => handle(e.target.files?.[0] || null)} />
    </div>
  );
}

interface MultiProps {
  value?: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  label?: string;
}

export function MediaUploadMulti({ value = [], onChange, folder = "uploads", label = "Add media" }: MultiProps) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handle = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      const urls = await Promise.all(Array.from(files).map((f) => uploadOne(f, folder)));
      onChange([...value, ...urls]);
      toast.success(`Uploaded ${urls.length} file${urls.length > 1 ? "s" : ""}`);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {value.map((u, i) => (
          <div key={u + i} className="relative aspect-square rounded-xl overflow-hidden glass group">
            <SmartMedia src={u} className="w-full h-full" autoplay={false} />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
              <button type="button" onClick={() => move(i, -1)} className="size-7 grid place-items-center rounded-lg bg-black/70 text-white"><GripVertical className="size-3 -rotate-90" /></button>
              <button type="button" onClick={() => move(i, 1)} className="size-7 grid place-items-center rounded-lg bg-black/70 text-white"><GripVertical className="size-3 rotate-90" /></button>
              <button type="button" onClick={() => remove(i)} className="size-7 grid place-items-center rounded-lg bg-destructive text-white"><X className="size-3" /></button>
            </div>
            {isVideoUrl(u) && <span className="absolute top-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">VIDEO</span>}
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handle(e.dataTransfer.files); }}
          className="aspect-square rounded-xl glass border border-dashed border-primary/30 hover:border-primary grid place-items-center text-center text-xs text-muted-foreground hover:text-accent transition-all"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <div><Upload className="size-5 mx-auto mb-1" />{label}</div>}
        </button>
      </div>
      <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => handle(e.target.files)} />
    </div>
  );
}
