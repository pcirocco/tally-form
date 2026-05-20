import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const {
  PORT = 3000,
  HUBSPOT_PORTAL_ID,
  HUBSPOT_FORM_GUID,
  TALLY_FORM_URL
} = process.env;

const fieldMap = {
  "Email": "email",
  "First name": "firstname",
  "Last name": "lastname",
  "Company": "company",
  "Phone": "phone",
  "Message": "message",
  "utm_campaign": "utm_campaign",
  "UTM Campaign": "utm_campaign"
};

app.get("/", (_req, res) => {
  res.send("Tally -> HubSpot webhook is running");
});

app.post("/webhooks/tally", async (req, res) => {
  try {
    const tallyPayload = req.body;
    const tallyFields = tallyPayload?.data?.fields || [];

    console.log("Tally webhook received:", JSON.stringify(tallyPayload, null, 2));

    const hubspotFields = tallyFields
      .filter(
        (field) =>
          fieldMap[field.label] &&
          field.value !== undefined &&
          field.value !== null &&
          field.value !== ""
      )
      .map((field) => ({
        name: fieldMap[field.label],
        value: Array.isArray(field.value) ? field.value.join("; ") : String(field.value)
      }));

    if (!hubspotFields.length) {
      return res.status(400).json({
        error: "No mappable fields found in Tally payload"
      });
    }

    const hubspotPayload = {
      fields: hubspotFields,
      submittedAt: String(Date.now()),
      context: {
        pageName: tallyPayload?.data?.formName || "Tally form",
        pageUri: TALLY_FORM_URL || "https://tally.so"
      }
    };

    const hubspotUrl = `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_GUID}`;

    const hubspotResponse = await fetch(hubspotUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(hubspotPayload)
    });

    const responseText = await hubspotResponse.text();

    if (!hubspotResponse.ok) {
      return res.status(hubspotResponse.status).json({
        error: "HubSpot submission failed",
        details: responseText
      });
    }

    return res.status(200).json({
      ok: true,
      hubspotResponse: responseText ? JSON.parse(responseText) : {}
    });
  } catch (error) {
    return res.status(500).json({
      error: "Unexpected server error",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});