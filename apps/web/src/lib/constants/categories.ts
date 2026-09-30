/** Category & subcategory taxonomy — PRD §4.6. */
export interface Subcategory {
  slug: string;
  name: string;
}

export interface Category {
  slug: string;
  name: string;
  subcategories: Subcategory[];
}

const sub = (slug: string, name: string): Subcategory => ({ slug, name });

export const CATEGORIES: Category[] = [
  {
    slug: "graphics-design",
    name: "Graphics & Design",
    subcategories: [
      sub("logo-design-tweaks", "Logo Design & Tweaks"),
      sub("flyer-social-banners", "Flyer & Social Media Banners"),
      sub("business-card-layouts", "Business Card Layouts"),
      sub("vector-app-icon-design", "Vector App Icon Design"),
      sub("background-removal-retouching", "Background Removal & Photo Retouching"),
    ],
  },
  {
    slug: "programming-tech",
    name: "Programming & Tech",
    subcategories: [
      sub("bug-fixes-html-css-js", "Bug Fixes (HTML/CSS & JavaScript)"),
      sub("responsive-mobile-layout-fix", "Responsive Mobile Layout Fix"),
      sub("single-landing-page", "Single Landing Page Implementation"),
      sub("script-automation-fix", "Script & Automation Quick Fix"),
      sub("api-webhook-integration", "API Webhook Integration"),
    ],
  },
  {
    slug: "writing-translation",
    name: "Writing & Translation",
    subcategories: [
      sub("proofreading", "Proofreading (Up to 1,000 words)"),
      sub("technical-docs-polish", "Technical Documentation Polish"),
      sub("product-description-copy", "Product Description Copy"),
      sub("resume-cover-letter", "Resume & Cover Letter Tweak"),
      sub("short-translation", "English / Spanish / French Short Translation"),
    ],
  },
  {
    slug: "video-animation",
    name: "Video & Animation",
    subcategories: [
      sub("short-video-trim", "Short Video Trim & Cut (Under 60s)"),
      sub("subtitle-caption-burn-in", "Subtitle & Caption Burn-in"),
      sub("intro-outro-animation", "Intro / Outro Logo Animation"),
      sub("audio-noise-cleanup", "Video Audio Noise Cleanup"),
    ],
  },
  {
    slug: "digital-marketing",
    name: "Digital Marketing",
    subcategories: [
      sub("technical-seo-audit", "Website Technical SEO Audit"),
      sub("social-media-copywriting", "Social Media Copywriting (5 Posts)"),
      sub("email-newsletter-polish", "Email Newsletter Template Polish"),
      sub("meta-opengraph-optimization", "Meta Tag & OpenGraph Optimization"),
    ],
  },
  {
    slug: "operations-admin",
    name: "Operations & Admin",
    subcategories: [
      sub("data-entry-csv-cleaning", "Data Entry & CSV Cleaning (Up to 500 rows)"),
      sub("pdf-conversion", "PDF to Word / Markdown Conversion"),
      sub("virtual-assistant-task", "Virtual Assistant Task (1 Hour Fixed Scope)"),
    ],
  },
];

export function findCategory(slug: string | undefined): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
