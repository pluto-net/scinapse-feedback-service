import axios from "axios";
import { google } from "googleapis";
import { JWT } from "google-auth-library";
import {
  FeedbackTicket,
  FreshdeskTicket,
} from "@pluto_network/scinapse-feedback";
import {
  SLACK_SCINAPSE_FEEDBACK_WEBHOOK_URL,
  GOOGLE_SHEET_CLIENT_EMAIL,
  GOOGLE_SHEET_PRIVATE_KEY,
  SCOPES,
  SPREAD_SHEET_ID,
  FRESHDESK_SCINAPSE_WEBHOOK_URL,
  FRESHDESK_PRIVATE_API_KEY,
} from "./accessKeys";

function mapResource(str: string | undefined | null): string {
  if (typeof str === "string") {
    return str;
  } else {
    return "N/A";
  }
}

// POST https://qg6wp4ze48.execute-api.us-east-1.amazonaws.com/prod/feedbacks/new
export async function handleFeedback(event, context, callback) {
  if (!event.body) {
    throw new Error("Feedback is missing.");
  }

  if (!SLACK_SCINAPSE_FEEDBACK_WEBHOOK_URL) {
    throw new Error("SLACK TOKEN is missing");
  }

  const feedbackTicket: FeedbackTicket = JSON.parse(event.body);

  let slackMessage = feedbackTicket.content;
  if (feedbackTicket.email) {
    slackMessage = `${feedbackTicket.email} - ${feedbackTicket.content}`;
  }

  try {
    await axios.post(SLACK_SCINAPSE_FEEDBACK_WEBHOOK_URL, {
      text: slackMessage,
    });
  } catch (err) {
    console.error(err);
  }

  const jwtClient = new JWT({
    email: GOOGLE_SHEET_CLIENT_EMAIL,
    key: GOOGLE_SHEET_PRIVATE_KEY!.replace(/\\n/g, "\n").replace(/\u003d/, "="),
    scopes: SCOPES,
  });

  await new Promise((resolve, reject) => {
    jwtClient.authorize((err: Error, t: any) => {
      if (err) {
        console.error(err);
        reject();
      }
      resolve();
    });
  });

  const resource = {
    values: [
      [
        mapResource(feedbackTicket.userId),
        mapResource(feedbackTicket.gaId),
        mapResource(feedbackTicket.content),
        Date.now(),
        mapResource(feedbackTicket.email),
        mapResource(feedbackTicket.referer),
      ],
    ],
  };

  const sheets = google.sheets({ version: "v4", jwtClient });
  const request = {
    spreadsheetId: SPREAD_SHEET_ID,
    range: "Sheet1",
    valueInputOption: "RAW",
    resource,
    auth: jwtClient,
  };

  sheets.spreadsheets.values.append(request, (err, result) => {
    if (err) {
      console.error(err);
    } else {
      console.log(result);
    }
  });

  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
    body: JSON.stringify({
      success: true,
    }),
  };

  callback(null, response);
}

// POST https://qg6wp4ze48.execute-api.us-east-1.amazonaws.com/prod/ticket/new
export async function handleSendTicketToFreshDesk(event, context, callback) {
  if (!event.body) {
    throw new Error("Feedback is missing.");
  }

  const feedbackTicket: FreshdeskTicket = JSON.parse(event.body);

  if (!SLACK_SCINAPSE_FEEDBACK_WEBHOOK_URL) {
    throw new Error("SLACK TOKEN is missing");
  }

  let slackMessage = feedbackTicket.description;

  if (feedbackTicket.email) {
    slackMessage = `${feedbackTicket.email} - ${feedbackTicket.description}`;
  }

  try {
    await axios.post(SLACK_SCINAPSE_FEEDBACK_WEBHOOK_URL, {
      text: slackMessage,
    });
  } catch (err) {
    console.error(err);
  }

  if (!FRESHDESK_SCINAPSE_WEBHOOK_URL || !FRESHDESK_PRIVATE_API_KEY) {
    throw new Error("FRESHDESK TOKEN is missing");
  }

  try {
    await axios.post(FRESHDESK_SCINAPSE_WEBHOOK_URL, feedbackTicket, {
      auth: {
        username: FRESHDESK_PRIVATE_API_KEY,
        password: "X",
      },
    });
  } catch (err) {
    console.error(err);
  }

  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
    body: JSON.stringify({
      success: true,
    }),
  };

  callback(null, response);
}
