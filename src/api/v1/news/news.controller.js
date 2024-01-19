// controllers/newsController.js
import { PrismaClient } from "@prisma/client";
import { SearchNewsQuerySchema,GetNewsQuerySchema,updateNewsSchema,logViewSchema,idSchema,createNewsSchema } from "./news.schema.js"
const prisma = new PrismaClient();

const ITEMS_PER_PAGE = 10;

export const getNews = async (req, res, next) => {
  try {
    const { page, category } = GetNewsQuerySchema.parse(req.query);
    const parsedPage = parseInt(page) || 1;
    const pageSize = ITEMS_PER_PAGE;
    const skip = (parsedPage - 1) * pageSize;
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

    const totalPages = Math.ceil(totalNews / pageSize);

    const news = await prisma.news.findMany({
      take: pageSize,
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
        countPerPage: news.length, // Add count per page
      },
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};


export const searchNews = async (req, res, next) => {
  let { title, titleTh, category, page, pageSize } = SearchNewsQuerySchema.parse(req.query);

  // Decode URL parameters
  title = decodeURIComponent(title || '');
  titleTh = decodeURIComponent(titleTh || '');
  // category = decodeURIComponent(category || '');
  page = parseInt(page) || 1;
  pageSize = parseInt(pageSize) || ITEMS_PER_PAGE;

  try {
    let whereConditions = {};

    if (title || titleTh) {
      whereConditions.AND = [
        { title: { contains: title } },
        { titleTh: { contains: titleTh } },
      ];
    }

    if (category) {
      whereConditions.category = { contains: category };
    }

    const totalCount = await prisma.news.count({ where: whereConditions });

    const totalPages = Math.ceil(totalCount / pageSize);
    const skip = (page - 1) * pageSize;

    const news = await prisma.news.findMany({
      where: whereConditions,
      take: pageSize,
      skip: skip,
    });

    if (news && news.length > 0) {
      return res.status(200).json({
        success: true,
        data: news,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: totalCount,
          itemsPerPage: pageSize,
          countPerPage: news.length, // Add count per page
        },
      });
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
    } = createNewsSchema.parse(req.body);
  
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
    const { id } = idSchema.parse(req.params);
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
    } = updateNewsSchema.parse(req.body);
  
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
export const deleteNews = async (req, res, next) => {
    const { id } = idSchema.parse(req.params);
  
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
  
//http://ip-api.com/json/?fields=query
export const logView = async (req, res, next) => {
  try {
    const { newsId, userIp } = logViewSchema.parse(req.body);

    // Check User-Agent
    const userAgent = req.get('User-Agent');

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
          viewedBy: {
            create: { ip: userIp, userAgent }
          },
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
