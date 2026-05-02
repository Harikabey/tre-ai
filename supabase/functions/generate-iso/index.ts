// Generates an ISO 9660 disk image from a list of files.
// Adapted from v86's iso9660.js (https://github.com/copy/v86, BSD-2).
// Limitations: single flat directory, ~42 files, MS-DOS 8.3 filenames, max ~50MB total.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-voice-mode",
};

const BLOCK_SIZE = 2048;
const FILE_FLAGS_DIRECTORY = 1 << 1;

interface IsoFile { name: string; contents: Uint8Array; }

function generateIso(files: IsoFile[], volumeId = "TRE_DISK"): Uint8Array {
  const te = new TextEncoder();
  const date = new Date();

  const write8 = (b: any, v: number) => { b.buffer[b.offset++] = v; };
  const write_le16 = (b: any, v: number) => { b.buffer[b.offset++] = v & 0xff; b.buffer[b.offset++] = (v >> 8) & 0xff; };
  const write_le32 = (b: any, v: number) => { b.buffer[b.offset++] = v & 0xff; b.buffer[b.offset++] = (v >> 8) & 0xff; b.buffer[b.offset++] = (v >> 16) & 0xff; b.buffer[b.offset++] = (v >> 24) & 0xff; };
  const write_be16 = (b: any, v: number) => { b.buffer[b.offset++] = (v >> 8) & 0xff; b.buffer[b.offset++] = v & 0xff; };
  const write_be32 = (b: any, v: number) => { b.buffer[b.offset++] = (v >> 24) & 0xff; b.buffer[b.offset++] = (v >> 16) & 0xff; b.buffer[b.offset++] = (v >> 8) & 0xff; b.buffer[b.offset++] = v & 0xff; };
  const write_lebe16 = (b: any, v: number) => { write_le16(b, v); write_be16(b, v); };
  const write_lebe32 = (b: any, v: number) => { write_le32(b, v); write_be32(b, v); };
  const fill = (b: any, len: number, v: number) => { b.buffer.fill(v, b.offset, b.offset += len); };
  const write_ascii = (b: any, v: string) => { b.offset += te.encodeInto(v, b.buffer.subarray(b.offset)).written; };
  const write_padded_ascii = (b: any, len: number, v: string) => { b.offset += te.encodeInto(v.padEnd(len), b.buffer.subarray(b.offset)).written; };
  const write_dummy_date_ascii = (b: any) => { fill(b, 16, 0x20); write8(b, 0); };
  const write_date_compact = (b: any) => {
    write8(b, date.getUTCFullYear() - 1900);
    write8(b, 1 + date.getUTCMonth());
    write8(b, date.getUTCDate());
    write8(b, date.getUTCHours());
    write8(b, date.getUTCMinutes());
    write8(b, date.getUTCSeconds());
    write8(b, 0);
  };
  const skip = (b: any, len: number) => { b.offset += len; };

  const to_msdos = (name: string) => {
    const dot = name.lastIndexOf(".");
    if (dot === -1) return name.substr(0, 8);
    return name.substr(0, Math.min(8, dot)) + "." + name.substr(dot + 1, 3);
  };
  const sanitise = (name: string) => to_msdos(name.toUpperCase().replace(/[^A-Z0-9_.]/g, "_"));
  const round_blk = (n: number) => n === 0 ? 0 : 1 + Math.floor((n - 1) / BLOCK_SIZE);

  const write_record = (b: any, name: string, flags: number, is_special: boolean, lba: number, len: number) => {
    if (!is_special) name = sanitise(name) + ";1";
    const NAME_OFFSET = 33;
    const name_len = te.encodeInto(name, b.buffer.subarray(b.offset + NAME_OFFSET)).written;
    const pad = (name_len & 1) ? 0 : 1;
    const len_field = 33 + name_len + pad;
    write8(b, len_field);
    write8(b, 0);
    write_lebe32(b, lba);
    write_lebe32(b, len);
    write_date_compact(b);
    write8(b, flags);
    write8(b, 0);
    write8(b, 0);
    write_lebe16(b, 1);
    write8(b, name_len);
    skip(b, name_len + pad);
  };

  const SYSTEM_AREA_SIZE = 16 * BLOCK_SIZE;
  const PRIMARY_VOLUME_LBA = 16;
  const VOLUME_SET_TERMINATOR_LBA = 17;
  const LE_PATH_TABLE_LBA = 19;
  const BE_PATH_TABLE_LBA = 21;
  const ROOT_DIRECTORY_LBA = 23;

  let next_file_lba = 24;
  const placedFiles = files.map(({ name, contents }) => {
    const lba = next_file_lba;
    next_file_lba += round_blk(contents.length);
    return { name: to_msdos(name), contents, lba };
  });

  const N_LBAS = next_file_lba;
  const total_size = N_LBAS * BLOCK_SIZE;
  const buffer = { buffer: new Uint8Array(total_size), offset: SYSTEM_AREA_SIZE };

  // Primary Volume Descriptor
  write8(buffer, 0x01);
  write_ascii(buffer, "CD001");
  write8(buffer, 0x01);
  write8(buffer, 0x00);
  write_padded_ascii(buffer, 32, "TRE");
  write_padded_ascii(buffer, 32, volumeId.substring(0, 32));
  skip(buffer, 8);
  write_lebe32(buffer, N_LBAS);
  skip(buffer, 32);
  write_lebe16(buffer, 1);
  write_lebe16(buffer, 1);
  write_lebe16(buffer, BLOCK_SIZE);
  write_lebe32(buffer, 10);
  write_le32(buffer, LE_PATH_TABLE_LBA);
  write_le32(buffer, 0);
  write_be32(buffer, BE_PATH_TABLE_LBA);
  write_be32(buffer, 0);
  write_record(buffer, "\x00", FILE_FLAGS_DIRECTORY, true, ROOT_DIRECTORY_LBA, 0x800);
  fill(buffer, 128, 0x20);
  fill(buffer, 128, 0x20);
  fill(buffer, 128, 0x20);
  fill(buffer, 128, 0x20);
  fill(buffer, 37, 0x20);
  fill(buffer, 37, 0x20);
  fill(buffer, 37, 0x20);
  write_dummy_date_ascii(buffer);
  write_dummy_date_ascii(buffer);
  write_dummy_date_ascii(buffer);
  write_dummy_date_ascii(buffer);
  write8(buffer, 0x01);
  write8(buffer, 0x00);
  skip(buffer, 512);
  skip(buffer, 653);

  // Volume Descriptor Set Terminator
  buffer.offset = VOLUME_SET_TERMINATOR_LBA * BLOCK_SIZE;
  write8(buffer, 0xFF);
  write_ascii(buffer, "CD001");
  write8(buffer, 0x01);

  // LE Path Table
  buffer.offset = LE_PATH_TABLE_LBA * BLOCK_SIZE;
  write8(buffer, 0x01);
  write8(buffer, 0x00);
  write_le32(buffer, ROOT_DIRECTORY_LBA);
  write_le16(buffer, 1);
  write_ascii(buffer, "\x00");

  // BE Path Table
  buffer.offset = BE_PATH_TABLE_LBA * BLOCK_SIZE;
  write8(buffer, 0x01);
  write8(buffer, 0x00);
  write_be32(buffer, ROOT_DIRECTORY_LBA);
  write_be16(buffer, 1);
  write_ascii(buffer, "\x00");

  // Root directory
  buffer.offset = ROOT_DIRECTORY_LBA * BLOCK_SIZE;
  write_record(buffer, "\x00", FILE_FLAGS_DIRECTORY, true, ROOT_DIRECTORY_LBA, 0x800);
  write_record(buffer, "\x01", FILE_FLAGS_DIRECTORY, true, ROOT_DIRECTORY_LBA, 0x800);
  for (const { name, contents, lba } of placedFiles) {
    write_record(buffer, name, 0, false, lba, contents.length);
  }

  // File contents
  for (const { contents, lba } of placedFiles) {
    buffer.buffer.set(contents, lba * BLOCK_SIZE);
  }

  return buffer.buffer;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { files, volumeName, isoName } = body as {
      files: Array<{ name: string; contentBase64: string }>;
      volumeName?: string;
      isoName?: string;
    };

    if (!Array.isArray(files) || files.length === 0 || files.length > 40) {
      return new Response(JSON.stringify({ error: "files: 1-40 dosya gerekli (ISO 9660 tek dizin sınırı)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalBytes = 0;
    const decoded: IsoFile[] = files.map((f) => {
      if (!f.name || typeof f.contentBase64 !== "string") throw new Error("Geçersiz dosya formatı");
      const bin = Uint8Array.from(atob(f.contentBase64), (c) => c.charCodeAt(0));
      totalBytes += bin.length;
      if (totalBytes > 50 * 1024 * 1024) throw new Error("Toplam boyut 50MB'ı aşamaz");
      return { name: f.name, contents: bin };
    });

    const iso = generateIso(decoded, volumeName || "TRE_DISK");
    const safeName = (isoName || "tre-disk").replace(/[^a-zA-Z0-9._-]/g, "_") + ".iso";
    const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await adminClient.storage
      .from("generated-files")
      .upload(storagePath, iso, { contentType: "application/x-iso9660-image", upsert: false });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: `Yükleme başarısız: ${uploadError.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pub } = adminClient.storage.from("generated-files").getPublicUrl(storagePath);

    return new Response(JSON.stringify({
      url: pub.publicUrl,
      filename: safeName,
      size: iso.length,
      fileCount: decoded.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("generate-iso error:", error);
    const msg = error instanceof Error ? error.message : "Bilinmeyen hata";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
