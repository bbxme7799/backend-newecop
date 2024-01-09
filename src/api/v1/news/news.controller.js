// controllers/newsController.js
import { PrismaClient } from "@prisma/client";
import { SearchNewsQuerySchema,GetNewsQuerySchema } from "./news.schema.js"
const prisma = new PrismaClient();

const ITEMS_PER_PAGE = 10;

export const getNews = async (req, res, next) => {
    try {
        const { page, sort, order, category } = GetNewsQuerySchema.parse(req.query);
        const parsedPage = parseInt(page) || 1;
        const skip = (parsedPage - 1) * ITEMS_PER_PAGE;
        const sortField = req.query.sort || 'created_at';
        const sortOrder = req.query.order || 'desc'; // Default sorting order

        let whereCondition = {}; // Initial empty condition

        // Check if a category is provided in the query
        if (category) {
            whereCondition = {
                ...whereCondition,
                category,
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
                currentPage: parsedPage,
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
    let { title, titleTh } = SearchNewsQuerySchema.parse(req.query);
  
    // Decode URL parameters
    title = decodeURIComponent(title || '');
    titleTh = decodeURIComponent(titleTh || '');
  
    try {
      const news = await prisma.news.findFirst({
        where: {
          OR: [
            { title: { contains: title } },
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
      const updatedNews = await prisma.news.update({
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
          editor: editorUsername
            ? { connect: { username: editorUsername } } // Connect by username if provided
            : undefined,
        },
      });
  
      return res.status(200).json({ success: true, data: updatedNews });
    } catch (error) {
      console.error("Error in updateNews:", error);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    } finally {
      await prisma.$disconnect();
    }
  };
  
  
  // DELETE
// DELETE
export const deleteNews = async (req, res, next) => {
    const { id } = req.params;
  
    try {
      await prisma.news.delete({
        where: { id: parseInt(id) },
      });
  
      return res.status(200).json({ success: true, message: "News deleted successfully." });
    } catch (error) {
      console.error("Error in deleteNews:", error);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    } finally {
      await prisma.$disconnect();
    }
  };
  

  export const logView = async (req, res, next) => {
    try {
      const { newsId } = req.body;
  
      // Check User-Agent and IP Address
      const userAgent = req.get('User-Agent');
      const userIp = req.ip;
  
      // Check if this page has been viewed already
      const news = await prisma.news.findUnique({
        where: { id: newsId },
        include: { viewedBy: true }, // Include the related views
      });
  
      if (!news) {
        return res.status(404).json({ success: false, message: 'News not found' });
      }
  
      // Ensure that viewedBy array is defined
      const isViewed = news.viewedBy?.some((view) => view.ip === userIp && view.userAgent === userAgent);
  
      if (!isViewed) {
        // Log views and User-Agent and IP Address data
        await prisma.news.update({
          where: { id: newsId },
          data: {
            viewCount: news.viewCount + 1,
            viewedBy: [...news.viewedBy, { ip: userIp, userAgent }],
          },
        });
      }
  
      return res.status(200).json({ success: true, message: 'View logged successfully' });
    } catch (error) {
      console.error('Error logging view:', error);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    } finally {
      await prisma.$disconnect();
    }
  };

