import { createFileRoute } from "@tanstack/react-router";
import { Handshake, HeartHandshake, Lightbulb, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { MarketplaceHeader } from "@/components/marketplace/MarketplaceHeader";
import { PublicShell } from "@/components/marketplace/PublicShell";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [
    { title: "About Us | FEA Bulk" },
    { name: "description", content: "FEA BULK is a wholesale distribution division of FEA GROUP of Companies — connecting businesses, delivering value and building growth." },
    { property: "og:title", content: "About Us | FEA Bulk" },
    { property: "og:description", content: "A wholesale distribution division of FEA GROUP of Companies, connecting businesses across markets." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AboutPage,
});

const values = [
  { icon: ShieldCheck, title: "Trust and Transparency", text: "Building reliable relationships through ethical business practices and clear communication." },
  { icon: Sparkles, title: "Quality and Value", text: "Striving to provide products and wholesale opportunities that meet business needs and deliver value." },
  { icon: HeartHandshake, title: "Customer Commitment", text: "Understanding the requirements of our business partners and working toward long-term satisfaction." },
  { icon: Lightbulb, title: "Innovation and Growth", text: "Embracing new opportunities, efficient processes, and evolving market needs." },
  { icon: Handshake, title: "Partnership and Collaboration", text: "Creating mutually beneficial relationships that help suppliers, buyers, and businesses grow together." },
];

const whatWeDo = [
  "Wholesale Product Trading — supplying products in bulk to businesses and commercial buyers.",
  "Business-to-Business Distribution — connecting suppliers and manufacturers with retailers, resellers, and other business customers.",
  "Supplier and Buyer Networking — building commercial relationships that create opportunities for sustainable business growth.",
  "Retail and Reseller Support — helping businesses access wholesale purchasing opportunities to support their operations and expansion.",
  "Market Expansion — leveraging the wider FEA GROUP ecosystem to explore new business relationships and distribution opportunities.",
];

const leaders = [
  { name: "Mr. Anand Kumar Kali", role: "Chairman & CEO, FEA GROUP", line: "Provides overall leadership and strategic direction for the group's business ecosystem." },
  { name: "Mr. Sathish Kumar", role: "Chief Operating Officer (COO), FEA GROUP", line: "Supports operational strategy and the coordination of business activities across the group." },
  { name: "Mr. Anoop Prasanna", role: "Chief Marketing Officer (CMO), FEA GROUP", line: "Leads marketing strategy, brand development, and market positioning across the group's businesses." },
  { name: "Mr. M. Prabakaran", role: "Chief Finance Officer (CFO), FEA GROUP", line: "Oversees financial strategy, financial planning, and financial management." },
  { name: "Mr. Srikanth Burra", role: "Chief Technical Officer (CTO), FEA GROUP", line: "Provides technology leadership and supports technological development and innovation." },
];

function AboutPage() {
  return (
    <PublicShell fullWidth header={<MarketplaceHeader />}>
      <section className="bg-workspace-nav text-workspace-nav-foreground">
        <div className="public-container py-12 sm:py-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-workspace-action">A Wholesale Distribution Division by FEA GROUP</p>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">FEA BULK</h1>
          <p className="mt-4 max-w-xl text-2xl font-semibold leading-snug sm:text-3xl">Connecting Businesses. Delivering Value. Building Growth.</p>
        </div>
      </section>

      <div className="public-container py-10 sm:py-14">
        <section className="max-w-3xl">
          <h2 className="text-2xl font-bold text-workspace-brand sm:text-3xl">About FEA BULK</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            FEA BULK is a wholesale product distribution company under the umbrella of FEA GROUP of Companies, a multi-sector
            organization committed to creating business opportunities and driving sustainable growth across industries.
          </p>
          <p className="mt-4 leading-7 text-muted-foreground">
            With a focus on wholesale trading, product distribution, and business-to-business partnerships, FEA BULK aims to bridge
            the gap between manufacturers, suppliers, retailers, resellers, and entrepreneurs. The company strives to make products
            more accessible to businesses through reliable sourcing, competitive wholesale opportunities, and a customer-focused approach.
          </p>
          <p className="mt-4 leading-7 text-muted-foreground">
            As part of the broader FEA ecosystem, FEA BULK benefits from the group's integrated business network, strategic leadership,
            and commitment to building long-term relationships. By connecting products with the right markets, FEA BULK seeks to empower
            businesses of different sizes to grow, expand, and succeed.
          </p>
        </section>

        <section className="mt-12 max-w-3xl">
          <h2 className="text-2xl font-bold text-workspace-brand sm:text-3xl">About FEA GROUP</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            FEA GROUP of Companies is a multi-sector organization committed to building opportunities across industries.
          </p>
          <p className="mt-4 leading-7 text-muted-foreground">
            From financial support and brand development to wholesale distribution, luxury experiences, business networking, and retail
            expansion, FEA GROUP connects people, products, and possibilities.
          </p>
          <p className="mt-4 leading-7 text-muted-foreground">
            Through an integrated business ecosystem, FEA GROUP empowers entrepreneurs, startups, established businesses, and communities
            with innovative solutions, strategic partnerships, and opportunities for long-term growth.
          </p>
          <p className="mt-4 leading-7 text-muted-foreground">
            FEA BULK represents the group's commitment to wholesale commerce, distribution, and creating new possibilities for businesses
            across markets.
          </p>
        </section>

        <section className="mt-12 grid gap-5 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-7">
            <p className="text-xs font-semibold uppercase tracking-wider text-workspace-warning">Our Mission</p>
            <p className="mt-3 leading-7">
              To simplify wholesale purchasing and distribution by connecting businesses with quality products, competitive opportunities,
              and dependable business partnerships that support sustainable growth.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-7">
            <p className="text-xs font-semibold uppercase tracking-wider text-workspace-warning">Our Vision</p>
            <p className="mt-3 leading-7">
              To become a trusted and recognized wholesale distribution partner, creating a strong network of suppliers, retailers,
              resellers, and entrepreneurs while contributing to the growth of the wider business community.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-workspace-brand sm:text-3xl">Our Core Values</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {values.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-lg border bg-card p-6">
                <Icon className="size-5 text-workspace-action" aria-hidden="true" />
                <h3 className="mt-3 font-bold text-workspace-brand">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 max-w-3xl">
          <h2 className="text-2xl font-bold text-workspace-brand sm:text-3xl">What We Do</h2>
          <p className="mt-4 leading-7 text-muted-foreground">FEA BULK is focused on developing wholesale business opportunities through:</p>
          <ul className="mt-4 space-y-3">
            {whatWeDo.map((item) => (
              <li key={item} className="flex gap-3 leading-7">
                <TrendingUp className="mt-1.5 size-4 shrink-0 text-workspace-action" aria-hidden="true" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Our specific product categories, distribution channels, and service offerings can be incorporated into this profile as the
            business expands.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-workspace-brand sm:text-3xl">Leadership of FEA GROUP</h2>
          <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">
            FEA BULK operates within the broader FEA GROUP ecosystem, supported by the group's senior leadership and strategic direction.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {leaders.map((person) => (
              <article key={person.name} className="rounded-lg border bg-card p-6">
                <h3 className="font-bold text-workspace-brand">{person.name}</h3>
                <p className="mt-1 text-sm font-semibold text-workspace-action">{person.role}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{person.line}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 max-w-3xl">
          <h2 className="text-2xl font-bold text-workspace-brand sm:text-3xl">The FEA BULK Advantage</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            As part of FEA GROUP, FEA BULK aims to combine wholesale business opportunities with the advantages of a connected,
            multi-sector organization. Our approach is built around:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-muted-foreground">
            <li>A business-focused wholesale distribution model.</li>
            <li>Opportunities for supplier, retailer, and reseller partnerships.</li>
            <li>A commitment to dependable business relationships.</li>
            <li>A growth-oriented approach to market development.</li>
            <li>Access to the wider FEA GROUP business ecosystem.</li>
          </ul>
        </section>

        <section className="mt-12 max-w-3xl">
          <h2 className="text-2xl font-bold text-workspace-brand sm:text-3xl">Our Commitment</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            At FEA BULK, we believe wholesale distribution is more than the movement of products—it is about creating connections,
            enabling commerce, and helping businesses unlock their potential.
          </p>
          <p className="mt-4 leading-7 text-muted-foreground">
            By bringing suppliers and buyers closer together, we aim to create a reliable foundation for business growth and lasting partnerships.
          </p>
        </section>
      </div>

      <section className="bg-workspace-nav text-workspace-nav-foreground">
        <div className="public-container py-12 text-center sm:py-16">
          <p className="text-2xl font-bold leading-snug sm:text-3xl">FEA BULK — Your Partner in Wholesale. Your Connection to Growth.</p>
          <p className="mt-4 text-sm text-workspace-nav-foreground/80">A business division of FEA GROUP of Companies.</p>
        </div>
      </section>
    </PublicShell>
  );
}
