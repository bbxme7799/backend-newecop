import axios from "axios";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";


const generateUniqueId = () => "_" + Math.random().toString(36).substr(2, 9);


export  const downloadImage = async (imageUrl, folderPath) => {
    console.log("🚀 ~ downloadImage ~ imageUrl:", imageUrl)
    try {
      const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
      const webpBuffer = await sharp(response.data).webp().toBuffer();
      const fileNameWithoutExtension = generateUniqueId();
      const webpFilePath = path.join(folderPath, `${fileNameWithoutExtension}.webp`);
      await fs.writeFile(webpFilePath, webpBuffer);
      console.log(`Downloaded image: ${fileNameWithoutExtension}.webp`);
      return `${fileNameWithoutExtension}.webp`;
    } catch (error) {
      console.error(`Failed to download image from ${imageUrl}: ${error.message}`);
      return null;
    }
  };