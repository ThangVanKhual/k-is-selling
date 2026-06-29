import { prisma } from './db.js';

async function main() {
  // 1. Seed global settings
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      bookPublished: true
    }
  });
  console.log('Settings seeded:', settings);

  // 2. Seed catalog products
  const products = [
    {
      id: 'kp_blueprint',
      name: 'KP Software Architecture Blueprint',
      description: 'The comprehensive blueprint for engineering resilient, production-grade web systems. Features API designs, caching architectures, security baselines, and production checklist templates.',
      price: 120.00,
      pdfLocator: 'sample.pdf',
      epubLocator: 'sample.epub',
      pdfFilename: 'KP_Architecture_Blueprint.pdf',
      epubFilename: 'KP_Architecture_Blueprint.epub'
    },
    {
      id: 'openai',
      name: 'Chat GPT',
      description: 'Deploy production-grade LLM applications. Learn custom agentic pipelines, structured JSON schema generation, assistant caching, and vector indexing with GPT-4.',
      price: 80.00,
      pdfLocator: 'sample.pdf',
      epubLocator: 'sample.epub',
      pdfFilename: 'OpenAI_Integration_Suite.pdf',
      epubFilename: 'OpenAI_Integration_Suite.epub'
    },
    {
      id: 'capcut',
      name: 'CAPCUt Pro Video Editor',
      description: 'Create high-converting social and branding content instantly. Includes premium cinematic preset LUTs, transition scripts, typography templates, and sound design files.',
      price: 100.00,
      pdfLocator: 'sample.pdf',
      epubLocator: 'sample.epub',
      pdfFilename: 'CapCut_Pro_Templates.pdf',
      epubFilename: 'CapCut_Pro_Templates.epub'
    },
    {
      id: 'gemini',
      name: 'Gemini Pro',
      description: 'Harness multi-modal models for text, vision, and audio reasoning. Includes prompt architectures, context-caching boilerplates, and function-calling integrations.',
      price: 85.00,
      pdfLocator: 'sample.pdf',
      epubLocator: 'sample.epub',
      pdfFilename: 'Gemini_Pro_Toolkit.pdf',
      epubFilename: 'Gemini_Pro_Toolkit.epub'
    },
    {
      id: 'canva',
      name: 'Canva EDU',
      description: 'Level up your brand identity. Master templates for slide decks, corporate kits, responsive web graphics, and custom branding palette layouts.',
      price: 10.00,
      pdfLocator: 'sample.pdf',
      epubLocator: 'sample.epub',
      pdfFilename: 'Canva_Pro_Branding_Kit.pdf',
      epubFilename: 'Canva_Pro_Branding_Kit.epub'
    }
  ];

  for (const prod of products) {
    const p = await prisma.product.upsert({
      where: { id: prod.id },
      update: {
        name: prod.name,
        description: prod.description,
        price: prod.price,
        pdfLocator: prod.pdfLocator,
        epubLocator: prod.epubLocator,
        pdfFilename: prod.pdfFilename,
        epubFilename: prod.epubFilename
      },
      create: prod
    });
    console.log(`Product seeded: ${p.id} with price RM ${p.price}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
