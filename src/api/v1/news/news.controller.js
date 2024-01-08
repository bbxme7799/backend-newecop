// controllers/newsController.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const ITEMS_PER_PAGE = 10;

export const getNews = async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const skip = (page - 1) * ITEMS_PER_PAGE;
      const sortField = req.query.sort || 'created_at';
      const sortOrder = req.query.order || 'desc'; // Default sorting order
  
      let whereCondition = {}; // Initial empty condition
  
      // Check if a category is provided in the query
      if (req.query.category) {
        whereCondition = {
          ...whereCondition,
          category: req.query.category,
        };
      }
  
      const totalNews = await prisma.news.count({
        where: whereCondition, // Apply the condition to the total count
      });
  
      const totalPages = Math.ceil(totalNews / ITEMS_PER_PAGE);
  
      const news = await prisma.news.findMany({
        take: ITEMS_PER_PAGE,
        skip: skip,
        orderBy: {
          [sortField]: sortOrder,
        },
        where: whereCondition, // Apply the condition to the news query
      });
  
      res.status(200).json({
        news,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalNews,
        },
      });
    } catch (error) {
      console.error(error);
      next(error);
    }
  };
  

  export const searchNews = async (req, res, next) => {
    let { title, titleTh } = req.query;
  
    // Decode URL parameters
    title = decodeURIComponent(title || '');
    titleTh = decodeURIComponent(titleTh || '');
  
    try {
      const news = await prisma.news.findFirst({
        where: {
          OR: [
            { title: { contains: title } },
            { titleTh: { contains: titleTh } },
          ],
        },
      });
  
      if (news) {
        return res.status(200).json({ success: true, data: news });
      } else {
        return res.status(404).json({ success: false, message: "News not found" });
      }
    } catch (error) {
      console.error("Error in searchNews:", error);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    } finally {
      await prisma.$disconnect();
    }
  };
  
  
  
  // CREATE
export const createNews = async (req, res, next) => {
    const {
      category,
      title,
      date,
      author,
      pTags,
      imgLinks,
      contentEn,
      ref,
      titleTh,
      contentTh,
      editorUsername,
    } = req.body;
  
    try {
      const news = await prisma.news.create({
        data: {
          category,
          title,
          date,
          author,
          pTags,
          imgLinks,
          contentEn,
          ref,
          titleTh,
          contentTh,
          editor: {
            connect: { username: editorUsername },
          },
        },
      });
  
      return res.status(201).json({ success: true, data: news });
    } catch (error) {
      console.error("Error in createNews:", error);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    } finally {
      await prisma.$disconnect();
    }
  };


  // UPDATE
export const updateNews = async (req, res, next) => {
    const { id } = req.params;
    const {
      category,
      title,
      date,
      author,
      pTags,
      imgLinks,
      contentEn,
      ref,
      titleTh,
      contentTh,
      editorUsername,
    } = req.body;
  
    try {
      const news = await prisma.news.update({
        where: { id: parseInt(id) },
        data: {
          category,
          title,
          date,
          author,
          pTags,
          imgLinks,
          contentEn,
          ref,
          titleTh,
          contentTh,
          editor: {
            connect: { username: editorUsername },
          },
        },
      });
  
      return res.status(200).json({ success: true, data: news });
    } catch (error) {
      console.error("Error in updateNews:", error);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    } finally {
      await prisma.$disconnect();
    }
  };
  
  // DELETE
  export const deleteNews = async (req, res, next) => {
    const { id } = req.params;
  
    try {
      const news = await prisma.news.delete({
        where: { id: parseInt(id) },
      });
  
      return res.status(200).json({ success: true, data: news });
    } catch (error) {
      console.error("Error in deleteNews:", error);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    } finally {
      await prisma.$disconnect();
    }
  };