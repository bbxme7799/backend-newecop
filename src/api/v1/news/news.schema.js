import * as z from "zod";

// Define validation schemas

// Schema for validating query parameters in the getNews controller
export const GetNewsQuerySchema = z.object({
  page: z.number().int().min(1).optional(),
  sort: z.string().optional(),
  order: z.string().optional(),
  category: z.string().optional(),
});

export const logViewSchema = z.object({
  newsId: z.number(),
  userIp: z.string(),
});

export const idSchema = z.object({
  id: z.string(),
});

// Schema for validating query parameters in the searchNews controller
export const SearchNewsQuerySchema = z.object({
  title: z.string().optional(),
  trendNew: z.string().optional(),
  titleTh: z.string().optional(),
  category: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export const NewsSchema = z.object({
  id: z.number(),
  category: z.string().nullable(),
  title: z.string().nullable(),
  date: z.string(),
  author: z.string(),
  pTags: z.string(),
  imgLinks: z.string(),
  contentEn: z.string().nullable(),
  ref: z.string(),
  titleTh: z.string().nullable(),
  contentTh: z.string().nullable(),
  editor: z.object({
    connect: z.object({
      username: z.string(),
    }),
  }).nullable(),
  editorUsername: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateNewsSchema = NewsSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});


export const DeleteNewsSchema = z.object({
  id: z.number(),
});


export const createNewsSchema = z.object({
  category: z.string(),
  title: z.string(),
  date: z.string(),
  author: z.string(),
  pTags: z.string(),
  imgLinks: z.string(),
  contentEn: z.string().optional(),
  ref: z.string(),
  titleTh: z.string().optional(),
  contentTh: z.string().optional(),
  editorUsername: z.string(),
});

export const updateNewsSchema = z.object({
  id: z.string(),
  category: z.string(),
  title: z.string(),
  date: z.string(),
  author: z.string(),
  pTags: z.string(),
  imgLinks: z.string(),
  contentEn: z.string().optional(),
  ref: z.string(),
  titleTh: z.string().optional(),
  contentTh: z.string().optional(),
  editorUsername: z.string().optional(),
});
