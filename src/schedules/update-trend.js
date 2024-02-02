import axios from 'axios';
import cheerio from 'cheerio';
import cron from 'node-cron';
import { PrismaClient } from "@prisma/client";

const url = 'https://thehackernews.com/';
const prisma = new PrismaClient();

async function fetchData(url) {
  try {
    const response = await axios.get(url);
    if (response.status === 200) {
      return response.data;
    }
  } catch (error) {
    throw new Error('Error fetching data:', error);
  }
}

function cleanHTML($) {
  $('.header.clear, .left-box, .below-post-box.cf, .footer-stuff.clear.cf').remove();
}

function getTitles($) {
  const titles = [];
  $('.pop-title').each((index, element) => {
    titles.push($(element).text());
  });
  console.log("🚀 ~ getTitles ~ titles:", titles)
  return titles;
}

function getResources($) {
  $('.widget.PopularPosts').remove();
  const resources = [];
  $('.pop-article').each((index, element) => {
    const title = $(element).find('.pop-title').text();
    resources.push(title);
  });
  console.log("🚀 ~ getResources ~ resources:", resources)
  return resources;
}

async function updateNews(news, trend) {
  try {
    await prisma.news.update({
      where: { id: news.id },
      data: { trend_new: trend },
    });
    console.log(`News "${news.title}" is now marked as ${trend} in the database.`);
  } catch (error) {
    console.error(`Error updating news "${news.title}":`, error);
  }
}

async function searchAndResetTrending(titles) {
  try {
    if (titles && titles.length > 0) {
      const trendingNews = await prisma.news.findMany({ where: { trend_new: 'Trending News' } });

      if (trendingNews.length > 0) {
        await Promise.all(trendingNews.map(async (news) => {
          if (!titles.includes(news.title)) {
            return updateNews(news, 'Normal');
          }
        }));
      }
    }
  } catch (error) {
    console.error('Error searching and resetting Trending News:', error);
  }
}

async function searchAndSetTrending(titles) {
  try {
    await Promise.all(titles.map(async (title) => {
      const existingNews = await prisma.news.findFirst({ where: { title } });
      if (existingNews) {
        return updateNews(existingNews, 'Trending News');
      }
    }));
  } catch (error) {
    console.error('Error searching and updating:', error);
  }
}

async function searchAndSetPopular(resources) {
  try {
    await Promise.all(resources.map(async (resource) => {
      const existingNews = await prisma.news.findFirst({ where: { title: resource } });
      if (existingNews) {
        return updateNews(existingNews, 'Popular');
      }
    }));
  } catch (error) {
    console.error('Error searching and updating:', error);
  }
}

async function searchAndResetTrendPopular(resources) {
  try {
    if (titles && titles.length > 0) {
      const trendingNews = await prisma.news.findMany({ where: { trend_new: 'Popular' } });

      if (trendingNews.length > 0) {
        await Promise.all(trendingNews.map(async (news) => {
          if (!titles.includes(news.title)) {
            return updateNews(news, 'Normal');
          }
        }));
      }
    }
  } catch (error) {
    console.error('Error searching and resetting Trending News:', error);
  }
}

export async function fetchDataAndSave() {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const htmlData = await fetchData(url);
      const $ = cheerio.load(htmlData);
      cleanHTML($);
  
      const titles = getTitles($);
      const resources = getResources($);
  
      await searchAndResetTrending(titles);
      await searchAndSetTrending(titles);
      await searchAndSetPopular(resources);
      await searchAndResetTrendPopular(resources)
  
      console.log('Data saved to the database.');
    } catch (error) {
      console.error(error.message);
    }
  });

}

