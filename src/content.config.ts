import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
const articles = defineCollection({loader: glob({pattern: '**/*.md', base: './src/content/articles'}),schema:z.object({title:z.string(),description:z.string(),category:z.string(),date:z.coerce.date(),updated:z.coerce.date().optional(),intent:z.string(),kind:z.enum(['guide','dossier','review']).default('guide')})});
export const collections={articles};
