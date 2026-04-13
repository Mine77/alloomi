CREATE TABLE IF NOT EXISTS "integration_catalog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" varchar(64) NOT NULL,
  "integration_id" varchar(32) NOT NULL,
  "integration_type" varchar(32) NOT NULL,
  "category" varchar(64) NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "url" text NOT NULL,
  "logo_url" text,
  "config" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "integration_catalog_slug_idx" ON "integration_catalog" ("slug");

CREATE TABLE IF NOT EXISTS "rss_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "catalog_id" uuid REFERENCES "integration_catalog"("id") ON DELETE SET NULL,
  "integration_account_id" uuid REFERENCES "platform_accounts"("id") ON DELETE SET NULL,
  "source_url" text NOT NULL,
  "title" text,
  "category" varchar(64),
  "status" varchar(32) NOT NULL DEFAULT 'active',
  "source_type" varchar(32) NOT NULL DEFAULT 'custom',
  "etag" text,
  "last_modified" text,
  "last_fetched_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "rss_subscriptions_user_url_idx" ON "rss_subscriptions" ("user_id","source_url");

CREATE TABLE IF NOT EXISTS "rss_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "subscription_id" uuid NOT NULL REFERENCES "rss_subscriptions"("id") ON DELETE CASCADE,
  "guid_hash" varchar(128) NOT NULL,
  "title" text,
  "summary" text,
  "content" text,
  "link" text,
  "published_at" timestamptz,
  "fetched_at" timestamptz NOT NULL DEFAULT now(),
  "status" varchar(32) NOT NULL DEFAULT 'pending',
  "metadata" jsonb DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS "rss_items_subscription_guid_idx" ON "rss_items" ("subscription_id","guid_hash");
CREATE INDEX IF NOT EXISTS "rss_items_published_idx" ON "rss_items" ("published_at");

INSERT INTO "integration_catalog" (
  "slug", "integration_id", "integration_type", "category",
  "title", "description", "url", "logo_url", "config"
)
VALUES
  (
    'bankless',
    'rss',
    'feed',
    'web3',
    'Bankless',
    'Daily macro coverage for crypto natives.',
    'https://bankless.ghost.io/rss/',
    'https://logo.clearbit.com/banklesshq.com',
    '{}'::jsonb
  ),
  (
    'the-defiant',
    'rss',
    'feed',
    'web3',
    'The Defiant',
    'DeFi and Web3 news curated for builders and traders.',
    'https://newsletter.thedefiant.io/feed',
    'https://logo.clearbit.com/thedefiant.io',
    '{}'::jsonb
  ),
  (
    'messari-minute',
    'rss',
    'feed',
    'web3',
    'Messari Mainnet',
    'Short-form crypto intel from Messari analysts.',
    'https://messari.io/rss',
    'https://logo.clearbit.com/messari.io',
    '{}'::jsonb
  ),
  (
    'bloomberg-markets',
    'rss',
    'feed',
    'finance',
    'Bloomberg Markets',
    'Breaking news across global equity, FX, and commodities.',
    'https://feeds.bloomberg.com/markets/news.rss',
    'https://logo.clearbit.com/bloomberg.com',
    '{}'::jsonb
  ),
  (
    'wsj-markets',
    'rss',
    'feed',
    'finance',
    'WSJ Markets',
    'Market-moving coverage from The Wall Street Journal.',
    'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
    'https://logo.clearbit.com/wsj.com',
    '{}'::jsonb
  ),
  (
    'ft-markets',
    'rss',
    'feed',
    'finance',
    'Financial Times Markets',
    'Global markets briefings from the FT newsroom.',
    'https://www.ft.com/markets?format=rss',
    'https://logo.clearbit.com/ft.com',
    '{}'::jsonb
  ),
  (
    'techcrunch',
    'rss',
    'feed',
    'technology',
    'TechCrunch',
    'Startup and product coverage across the tech ecosystem.',
    'https://techcrunch.com/feed/',
    'https://logo.clearbit.com/techcrunch.com',
    '{}'::jsonb
  ),
  (
    'the-verge',
    'rss',
    'feed',
    'technology',
    'The Verge',
    'Consumer tech, culture, and policy reporting.',
    'https://www.theverge.com/rss/index.xml',
    'https://logo.clearbit.com/theverge.com',
    '{}'::jsonb
  ),
  (
    'wired',
    'rss',
    'feed',
    'technology',
    'Wired',
    'Science and tech deep dives for builders and makers.',
    'https://www.wired.com/feed/rss',
    'https://logo.clearbit.com/wired.com',
    '{}'::jsonb
  ),
  (
    'latent-space',
    'rss',
    'feed',
    'ai',
    'Latent Space',
    'AI engineering tactics, interview notes, and tooling.',
    'https://www.latent.space/feed',
    'https://logo.clearbit.com/latent.space',
    '{}'::jsonb
  ),
  (
    'the-batch',
    'rss',
    'feed',
    'ai',
    'The Batch',
    'Weekly digest from deeplearning.ai on applied AI.',
    'https://www.deeplearning.ai/the-batch/feed/',
    'https://logo.clearbit.com/deeplearning.ai',
    '{}'::jsonb
  ),
  (
    'hugging-face',
    'rss',
    'feed',
    'ai',
    'Hugging Face Daily',
    'Research updates and product news from Hugging Face.',
    'https://huggingface.co/blog/feed.xml',
    'https://logo.clearbit.com/huggingface.co',
    '{}'::jsonb
  ),
  (
    'sidebar',
    'rss',
    'feed',
    'design',
    'Sidebar',
    'Five best design links every weekday.',
    'https://sidebar.io/feed.xml',
    'https://logo.clearbit.com/sidebar.io',
    '{}'::jsonb
  ),
  (
    'smashing-magazine',
    'rss',
    'feed',
    'design',
    'Smashing Magazine',
    'UX, UI, and front-end techniques for modern teams.',
    'https://www.smashingmagazine.com/feed/',
    'https://logo.clearbit.com/smashingmagazine.com',
    '{}'::jsonb
  ),
  (
    'muzli',
    'rss',
    'feed',
    'design',
    'Muzli',
    'Curated visual inspiration for product designers.',
    'https://muz.li/feed/',
    'https://logo.clearbit.com/muz.li',
    '{}'::jsonb
  ),
  (
    'anandtech',
    'rss',
    'feed',
    'hardware',
    'AnandTech',
    'Hardware deep dives and benchmarking analysis.',
    'https://www.anandtech.com/rss/',
    'https://logo.clearbit.com/anandtech.com',
    '{}'::jsonb
  ),
  (
    'hackaday',
    'rss',
    'feed',
    'hardware',
    'Hackaday',
    'Hardware hacking, prototyping, and embedded builds.',
    'https://hackaday.com/blog/feed/',
    'https://logo.clearbit.com/hackaday.com',
    '{}'::jsonb
  ),
  (
    'ieee-spectrum-hardware',
    'rss',
    'feed',
    'hardware',
    'IEEE Spectrum Hardware',
    'Engineering and manufacturing stories from IEEE Spectrum.',
    'https://spectrum.ieee.org/feed',
    'https://logo.clearbit.com/ieee.org',
    '{}'::jsonb
  )
ON CONFLICT ("slug") DO NOTHING;
