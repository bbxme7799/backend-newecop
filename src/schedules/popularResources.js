// popularResources.js
import axios from 'axios';
import cheerio from 'cheerio';
import cron from 'node-cron';
import { PrismaClient } from "@prisma/client";


const prisma = new PrismaClient();

async function getPopularResources() {
  const url = 'https://thehackernews.com/';
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

function getResources($) {
  $('.widget.PopularPosts').remove();
  const resources = [];
  $('.pop-article').each((index, element) => {
    const title = $(element).find('.pop-title').text();
    resources.push(title);
  });
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
    if (resources && resources.length > 0) {
      const trendingNews = await prisma.news.findMany({ where: { trend_new: 'Popular' } });

      if (trendingNews.length > 0) {
        await Promise.all(trendingNews.map(async (news) => {
          if (!resources.includes(news.title)) {
            return updateNews(news, 'Normal');
          }
        }));
      }
    }
  } catch (error) {
    console.error('Error searching and resetting Trending News:', error);
  }
}

export async function fetchPopularResourcesAndSave() {
  cron.schedule('0 */2 * * *', async () => {

  try {
    const htmlData = await getPopularResources();

    const $resources = cheerio.load(htmlData);
    cleanHTML($resources);

    const resources = getResources($resources);
    console.log("🚀 ~ cron.schedule ~ resources:", resources);

    await Promise.all([
      searchAndSetPopular(resources),
      searchAndResetTrendPopular(resources),
    ]);

    console.log('Popular Resources data saved to the database.');
  } catch (error) {
    console.error(error.message);
  }
});
}
