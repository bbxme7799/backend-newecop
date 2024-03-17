// controllers/newsController.js
import { PrismaClient } from "@prisma/client";
import axios from "axios";
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
  let { title, titleTh, category, page, pageSize, trendNew } = SearchNewsQuerySchema.parse(req.query);

  // Decode URL parameters
  title = decodeURIComponent(title || '');
  titleTh = decodeURIComponent(titleTh || '');
  page = parseInt(page) || 1;
  pageSize = parseInt(pageSize) || ITEMS_PER_PAGE;

  try {
    // Use Prisma to create parameterized queries
    const news = await prisma.news.findMany({
      where: {
        AND: [
          { title: { contains: title } },
          { titleTh: { contains: titleTh } },
        ],
        category: { contains: category },
        trend_new: { contains: trendNew }, // Add this line to search by trend_new
      },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });

    const totalCount = await prisma.news.count({
      where: {
        AND: [
          { title: { contains: title } },
          { titleTh: { contains: titleTh } },
        ],
        category: { contains: category },
        trend_new: { contains: trendNew }, // Add this line to search by trend_new
      },
    });

    const totalPages = Math.ceil(totalCount / pageSize);

    if (news && news.length > 0) {
      return res.status(200).json({
        success: true,
        data: news,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: totalCount,
          itemsPerPage: pageSize,
        },
      });
    } else {
      return res.status(404).json({ success: false, message: "News not found" });
    }
  } catch (error) {
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

    // Fetch user location data from the IP API
    const userLocation = await getUserLocation(userIp);

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
            create: {
              ip: userIp,
              userAgent,
              country: userLocation?.country || null,
              region: userLocation?.region || null,
              city: userLocation?.city || null,
              latitude: userLocation?.lat || null,
              longitude: userLocation?.lon || null,
            },
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


// Function to get user geographical information using ip-api.com
export const getUserLocation = async (ip) => {
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user location:', error);
    return null;
  }
};
export const getViewCount = async (req, res) => {
  try {
    const { period } = req.query;
    const startDate = getStartDate(period);

    const { views, newsTitles } = await getViewsAndTitlesByPeriod(startDate);
    const newsCounts = countNews(views);

    const newsData = Object.keys(newsTitles).map(id => ({
      id,
      title: newsTitles[id],
      count: newsCounts[id] || 0
    }));

    res.status(200).json({ success: true, newsData });
  } catch (error) {
    console.error('Error retrieving view count:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const getStartDate = (period) => {
  const startDate = new Date();
  if (period === '7') startDate.setDate(startDate.getDate() - 7);
  else if (period === '30') startDate.setDate(startDate.getDate() - 30);
  startDate.setHours(0, 0, 0, 0);
  return startDate;
};

export const getViewsAndTitlesByPeriod = async (startDate) => {
  try {
    const views = await prisma.view.findMany({
      where: { created_at: { gte: startDate } },
      include: { news: { select: { id: true, title: true } } }
    });

    const newsTitles = {};
    views.forEach(view => {
      const { id, title } = view.news;
      if (!newsTitles[id]) newsTitles[id] = title;
    });

    return { views, newsTitles };
  } catch (error) {
    console.error('Error counting views by period:', error);
    throw error;
  }
};

const countNews = (views) => {
  const newsCounts = {};
  views.forEach(view => {
    const { id } = view.news;
    newsCounts[id] = (newsCounts[id] || 0) + 1;
  });
  return newsCounts;
};
