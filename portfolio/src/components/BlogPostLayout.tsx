import { AtSign, Share2 } from "lucide-react";
import PageShell from "@/components/PageShell";
import { BLOG_POSTS, type BlogPostMeta } from "@/lib/blog";

export type TocItem = { id: string; label: string };

export default function BlogPostLayout({
  meta,
  toc,
  children,
}: {
  meta: BlogPostMeta;
  toc: TocItem[];
  children: React.ReactNode;
}) {
  const related = BLOG_POSTS.filter((p) => p.slug !== meta.slug).slice(0, 2);
  const shareUrl = `https://testsurge.kynetropo.com/blog/${meta.slug}`;

  return (
    <PageShell>
      <div className="mx-auto flex max-w-6xl gap-12 px-6 pb-24">
        {/* Sidebar TOC */}
        <aside className="sticky top-28 hidden h-fit w-56 shrink-0 lg:block">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-light">
            On this page
          </p>
          <nav className="mt-3 flex flex-col gap-2">
            {toc.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="text-sm text-text-secondary transition-colors hover:text-secondary"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-text-light">
            Share
          </p>
          <div className="mt-3 flex gap-2">
            <a
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(meta.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on Twitter"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-text-secondary transition-colors hover:border-secondary hover:text-secondary"
            >
              <AtSign size={16} />
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on LinkedIn"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-text-secondary transition-colors hover:border-secondary hover:text-secondary"
            >
              <Share2 size={16} />
            </a>
          </div>
        </aside>

        {/* Article */}
        <article className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-light">
            {meta.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-3 py-1 font-medium text-text-secondary">
                {tag}
              </span>
            ))}
          </div>

          <h1 className="mt-4 font-heading text-3xl font-bold text-text-primary md:text-5xl">
            {meta.title}
          </h1>

          <div className="mt-4 flex items-center gap-3 text-sm text-text-light">
            <span>By TestSurge Team</span>
            <span aria-hidden>·</span>
            <span>{meta.date}</span>
            <span aria-hidden>·</span>
            <span>{meta.readTime}</span>
          </div>

          {/* Mobile share buttons */}
          <div className="mt-4 flex gap-2 lg:hidden">
            <a
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(meta.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on Twitter"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-text-secondary"
            >
              <AtSign size={16} />
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on LinkedIn"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-text-secondary"
            >
              <Share2 size={16} />
            </a>
          </div>

          <div className="prose-testsurge mt-10 flex flex-col gap-6 text-text-secondary">
            {children}
          </div>

          {/* Related posts */}
          <section className="mt-16 border-t border-gray-100 pt-10">
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              Related posts
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {related.map((post) => (
                <a
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="rounded-2xl border border-gray-100 bg-muted p-5 transition-colors hover:border-secondary/30"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-secondary">
                    {post.tags[0]}
                  </p>
                  <p className="mt-2 font-heading font-bold leading-snug text-text-primary">
                    {post.title}
                  </p>
                  <p className="mt-2 text-sm text-text-light">{post.readTime}</p>
                </a>
              ))}
            </div>
          </section>
        </article>
      </div>
    </PageShell>
  );
}

export function CTABannerInline() {
  return (
    <div className="my-6 rounded-2xl bg-text-primary p-6 text-center md:p-8">
      <h3 className="font-heading text-xl font-bold text-white md:text-2xl">
        Try TestSurge free
      </h3>
      <p className="mt-2 text-sm text-gray-300">
        Generate your first set of AI test cases from a Jira story in minutes.
      </p>
      <a
        href="/signup"
        className="mt-4 inline-block rounded-full bg-secondary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-105"
      >
        Start Free — No Card Needed
      </a>
    </div>
  );
}
