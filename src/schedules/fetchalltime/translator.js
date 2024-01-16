// translator.js
import axios from "axios";
import fs from "fs/promises";


export  const translateText = async (text, targetLanguage = "th") => {
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    const translateApiUrl = "https://translation.googleapis.com/language/translate/v2";
  
    const textChunks = splitTextIntoChunks(text, 5000);
  
    try {
      const translations = await Promise.all(
        textChunks.map(async (chunk) => {
          const params = {
            key: apiKey,
            q: chunk,
            target: targetLanguage,
          };
  
          const response = await axios.post(translateApiUrl, null, { params });
          return response.data.data.translations[0].translatedText;
        })
      );
  
      const translatedText = translations.join(" ");
      console.log("🚀 ~ translateText ~ translatedText:", translatedText)
      return translatedText;
    } catch (error) {
      console.error("Translation error:", error.message);
      throw error;
    }
  };
  
  
  const splitTextIntoChunks = (text, chunkSize) => {
    const regex = new RegExp(`.{1,${chunkSize}}`, "g");
    return text.match(regex) || [];
  };
  
  export  const translateThai = async () => {
    const rawData = await fs.readFile("src/schedules/fetchalltime/article_data.json", "utf8");
    const articles = JSON.parse(rawData);
    console.log("🚀 ~ translateThai ~ articles:", articles)
    const translatedArticles = [];
  
    for (const article of articles) {
      const titleEn = article.title;
      const contentEn = article.contentEn;
  
      const titleTh = await translateText(titleEn);
      const contentTh = await translateText(contentEn);
  
      article.titleTh = titleTh;
      article.contentTh = contentTh;
  
      translatedArticles.push(article);
    }
  
    await fs.writeFile("src/schedules/fetchalltime/article_data.json", JSON.stringify(translatedArticles, null, 2), "utf8");
    console.log("Translation completed. Translated data saved to article_data.json");
  };
  