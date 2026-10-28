import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || "").trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[match[1]] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const client = createClient(supabaseUrl, anonKey);

async function seed() {
  console.log("Signing in as admin...");
  const authRes = await client.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });

  if (authRes.error) {
    console.error("Admin auth failed:", authRes.error.message);
    process.exit(1);
  }

  console.log("Authenticated as:", authRes.data.user.email);

  // Upload the 3 thumbnails to media/reels/
  const items = [
    {
      file: "src/assets/hero-image3.webp",
      storagePath: "reels/reel-idea-to-sales.webp",
      title: "من الفكرة حتى المبيعات",
      slug: "from-idea-to-sales",
      category: "Creative Strategy",
      caption: "كيف نحول الأفكار الإبداعية إلى مبيعات حقيقية ونتائج ملموسة لعلامتك التجارية.",
      display_order: 1,
      is_featured: true,
      is_published: true,
      instagram_url: "https://www.instagram.com/reel/C7-X5zTsp9Q/",
      instagram_shortcode: "C7-X5zTsp9Q",
    },
    {
      file: "src/assets/hero-image1.webp",
      storagePath: "reels/reel-strategy.webp",
      title: "استراتيجية تصنع الفرق",
      slug: "strategy-makes-difference",
      category: "Brand Growth",
      caption: "الاستراتيجية ليست مجرد خطة، بل هي البوصلة التي تقود كل قرار بصري وتسويقي.",
      display_order: 2,
      is_featured: false,
      is_published: true,
      instagram_url: "https://www.instagram.com/reel/C51m3K2I5vN/",
      instagram_shortcode: "C51m3K2I5vN",
    },
    {
      file: "src/assets/hero-image2.webp",
      storagePath: "reels/reel-sada-solution.webp",
      title: "SADA هي الحل",
      slug: "sada-is-the-solution",
      category: "Production",
      caption: "فريق متكامل يجمع التسويق والتطوير والإنتاج في مكان واحد.",
      display_order: 3,
      is_featured: false,
      is_published: true,
      instagram_url: "https://www.instagram.com/reel/C34v8LpI1wA/",
      instagram_shortcode: "C34v8LpI1wA",
    },
  ];

  for (const item of items) {
    console.log(`Processing ${item.title}...`);
    const fileBuffer = fs.readFileSync(path.resolve(process.cwd(), item.file));

    const { error: upErr } = await client.storage
      .from("media")
      .upload(item.storagePath, fileBuffer, {
        contentType: "image/webp",
        upsert: true,
      });

    if (upErr) {
      console.warn(`Storage upload warning for ${item.storagePath}:`, upErr.message);
    }

    const { data: urlData } = client.storage.from("media").getPublicUrl(item.storagePath);
    const thumbnailUrl = urlData.publicUrl;
    console.log(`Public URL: ${thumbnailUrl}`);

    // Insert or update record in social_reels
    const { data: existing } = await client
      .from("social_reels")
      .select("id")
      .eq("slug", item.slug)
      .maybeSingle();

    if (existing) {
      const { error: updErr } = await client
        .from("social_reels")
        .update({
          title: item.title,
          category: item.category,
          caption: item.caption,
          thumbnail_url: thumbnailUrl,
          instagram_url: item.instagram_url,
          instagram_shortcode: item.instagram_shortcode,
          display_order: item.display_order,
          is_featured: item.is_featured,
          is_published: item.is_published,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updErr) console.error(`Error updating ${item.slug}:`, updErr.message);
      else console.log(`Updated ${item.slug} (${existing.id})`);
    } else {
      const { error: insErr } = await client.from("social_reels").insert({
        slug: item.slug,
        title: item.title,
        category: item.category,
        caption: item.caption,
        thumbnail_url: thumbnailUrl,
        instagram_url: item.instagram_url,
        instagram_shortcode: item.instagram_shortcode,
        display_order: item.display_order,
        is_featured: item.is_featured,
        is_published: item.is_published,
      });

      if (insErr) console.error(`Error inserting ${item.slug}:`, insErr.message);
      else console.log(`Inserted ${item.slug}`);
    }
  }

  console.log("Seeding finished successfully!");
}

seed().catch(console.error);
