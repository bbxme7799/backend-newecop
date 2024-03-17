import express from "express";
import bodyParser from "body-parser";
import cookieSession from "cookie-session";
import config from "./config/index.js";
import morgan from "morgan";
import api from "./api/v1/index.js";
import cors from "cors";
import rateLimit  from 'express-rate-limit';
import helmet  from 'helmet';

import { NotFoundRequestException } from "./exceptions/not-found-request.exception.js";
import { errorHandlerMiddleware } from "./middlewares/error-handler.middleware.js";
// import { hackerNewFetchAlltime } from "./schedules/fetchalltime/main.js";
import { hackerNewFetchToday } from "./schedules/hackerNewFetchToday.js";
import { scrapeDarkReading } from "./schedules/darkreadingToday.js";
import { fetchDataAndSave } from "./schedules/update-trend.js";
import { fetchPopularResourcesAndSave } from "./schedules/popularResources.js";
// import { scrapeData } from "./schedules/cybernewToday.js";
const app = express();
app.use(helmet());

// resetProductSchedule();
hackerNewFetchToday();
scrapeDarkReading();
fetchDataAndSave();
// scrapeData();
fetchPopularResourcesAndSave();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(
  cookieSession({
    signed: false,
    secure: false,
  })
);

const whitelist = ["http://test.com"];

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null,whitelist.includes(origin))
    },
    credentials: true,
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  max: 50, // จำนวนคำขอสูงสุดที่อนุญาตให้ในช่วงเวลา 15 นาที
});

app.use('/api', limiter);

app.use("/api", api);
app.all("*", async (req, res, next) => {
  try {
    throw new NotFoundRequestException();
  } catch (error) {
    next(error);
  }
});

app.use(errorHandlerMiddleware);

app.listen(config.port, () => {
  console.log(process.env.NODE_ENV);
  console.log(`listening on port ${config.port}`);
  // console.log("For the UI, open http://localhost:8000/admin/queues");
});