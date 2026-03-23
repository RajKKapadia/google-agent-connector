import { Queue } from "bullmq";

export interface MessageJobData {
  channelId: string;
  waId: string;
  messageText: string;
  messageId: string;
  timestamp: number;
}

function getRedisConnection() {
  return { url: process.env.REDIS_URL! };
}

export const messageQueue = new Queue<MessageJobData>("whatsapp-messages", {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});
