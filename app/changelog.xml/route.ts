import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { changelogEntries } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const entries = await db
    .select()
    .from(changelogEntries)
    .orderBy(desc(changelogEntries.date))
    .limit(50);

  const rssItems = entries
    .map(
      (e) => `    <item>
      <title><![CDATA[${e.breaking ? "[BREAKING] " : ""}${e.title} (${e.version})]]></title>
      <link>https://relay.in/changelog#${e.id}</link>
      <guid>https://relay.in/changelog#${e.id}</guid>
      <pubDate>${new Date(e.date).toUTCString()}</pubDate>
      <category>${e.type}</category>
      <description><![CDATA[${e.body}]]></description>
    </item>`
    )
    .join("\n");

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Relay Developer Hub — API Changelog &amp; Deprecations</title>
    <link>https://relay.in/changelog</link>
    <description>Product updates, breaking schema changes, and sunset deprecation notices for the Relay Telecom &amp; CDP Developer APIs.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://relay.in/changelog.xml" rel="self" type="application/rss+xml"/>
${rssItems}
  </channel>
</rss>`;

  return new NextResponse(rssXml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
