//mobile/functions/src/index.ts
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import {
  RekognitionClient,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  DeleteFacesCommand,
} from "@aws-sdk/client-rekognition";

admin.initializeApp();

/* ============================
   🔐 DEFINE SECRETS
============================ */
const AWS_ACCESS_KEY_ID = defineSecret("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = defineSecret("AWS_SECRET_ACCESS_KEY");
const AWS_REGION = defineSecret("AWS_REGION");
const AWS_COLLECTION_ID = defineSecret("AWS_COLLECTION_ID");

function normalizeBase64Image(input: string): string {
  // Accept both raw base64 and data URI formats from mobile clients.
  return input.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "").trim();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unknown error";
}

function getAwsConfig() {
  return {
    region: AWS_REGION.value().trim(),
    collectionId: AWS_COLLECTION_ID.value().trim(),
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID.value().trim(),
      secretAccessKey: AWS_SECRET_ACCESS_KEY.value().trim(),
    },
  };
}

/* ============================
   1️⃣ INDEX STAFF FACE
============================ */
export const indexStaffFace = onRequest(
{
  secrets: [
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_REGION,
    AWS_COLLECTION_ID,
  ],
},
async (req, res): Promise<void> => {
  try {
    const { base64Image, staffId } = req.body;

    if (!base64Image || !staffId) {
      res.status(400).json({ error: "Missing data" });
      return;
    }

    const normalizedBase64 = normalizeBase64Image(base64Image);
    const aws = getAwsConfig();

    const rekognition = new RekognitionClient({
      region: aws.region,
      credentials: aws.credentials,
    });

    const imageBytes = Buffer.from(normalizedBase64, "base64");

    /* =====================================
       1️⃣ FIRST CHECK IF FACE ALREADY EXISTS
    ====================================== */

    const searchCommand = new SearchFacesByImageCommand({
      CollectionId: aws.collectionId,
      Image: { Bytes: imageBytes },
      FaceMatchThreshold: 90,
      MaxFaces: 1,
    });

    const searchResult = await rekognition.send(searchCommand);
    const existingMatch = searchResult.FaceMatches?.[0];

    if (existingMatch && existingMatch.Similarity && existingMatch.Similarity > 90) {
      res.status(409).json({
        error: "Face already registered",
        similarity: existingMatch.Similarity,
      });
      return;
    }

    /* =====================================
       2️⃣ INDEX FACE
    ====================================== */

    const command = new IndexFacesCommand({
      CollectionId: aws.collectionId,
      Image: { Bytes: imageBytes },
      ExternalImageId: staffId,
    });

    const response = await rekognition.send(command);

    const faceId = response.FaceRecords?.[0]?.Face?.FaceId;

    if (!faceId) {
      res.status(400).json({ error: "No face detected" });
      return;
    }

    await admin.firestore().collection("staff").doc(staffId).update({
      faceId,
      biometricEnabled: true,
    });

    res.json({ success: true, faceId });
    return;

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Indexing failed",
      details: getErrorMessage(error),
    });
    return;
  }
}
);
/* ============================
   2️⃣ SEARCH STAFF FACE
============================ */
export const searchStaffFace = onRequest(
  {
    secrets: [
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      AWS_REGION,
      AWS_COLLECTION_ID,
    ],
  },
  async (req, res): Promise<void> => {
    try {
      const { base64Image } = req.body;

      if (!base64Image) {
        res.status(400).json({ error: "Missing image" });
        return;
      }

      const normalizedBase64 = normalizeBase64Image(base64Image);
      const aws = getAwsConfig();

      const rekognition = new RekognitionClient({
        region: aws.region,
        credentials: aws.credentials,
      });

      const command = new SearchFacesByImageCommand({
        CollectionId: aws.collectionId,
        Image: {
          Bytes: Buffer.from(normalizedBase64, "base64"),
        },
        FaceMatchThreshold: 85,
        MaxFaces: 1,
      });

      const response = await rekognition.send(command);
      const match = response.FaceMatches?.[0];

      if (!match) {
        res.json({ matched: false });
        return;
      }

      const staffId = match.Face?.ExternalImageId;
      const similarity = match.Similarity;

      await admin.firestore().collection("staffAttendance").add({
        staffId,
        similarity,
        method: "biometric",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({
        matched: true,
        staffId,
        similarity,
      });
      return;
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Search failed",
        details: getErrorMessage(error),
      });
      return;
    }
  }
);

/* ============================
   3️⃣ DELETE FACE
============================ */
export const deleteStaffFace = onRequest(
  {
    secrets: [
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      AWS_REGION,
      AWS_COLLECTION_ID,
    ],
  },
  async (req, res): Promise<void> => {
    try {
      const { faceId } = req.body;
      const aws = getAwsConfig();

      if (!faceId) {
        res.status(400).json({ error: "Missing faceId" });
        return;
      }

      const rekognition = new RekognitionClient({
        region: aws.region,
        credentials: aws.credentials,
      });

      await rekognition.send(
        new DeleteFacesCommand({
          CollectionId: aws.collectionId,
          FaceIds: [faceId],
        })
      );

      res.json({ success: true });
      return;
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Delete failed" });
      return;
    }
  }
);
/* ============================
   1️⃣ INDEX STUDENT FACE
============================ */
export const indexStudentFace = onRequest(
  {
    secrets: [
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      AWS_REGION,
      AWS_COLLECTION_ID,
    ],
  },
  async (req, res): Promise<void> => {
    try {
      const { base64Image, studentId } = req.body;

      if (!base64Image || !studentId) {
        res.status(400).json({ error: "Missing data" });
        return;
      }

      const normalizedBase64 = normalizeBase64Image(base64Image);
      const aws = getAwsConfig();

      const rekognition = new RekognitionClient({
        region: aws.region,
        credentials: aws.credentials,
      });

      const imageBytes = Buffer.from(normalizedBase64, "base64");

      const searchCommand = new SearchFacesByImageCommand({
        CollectionId: aws.collectionId,
        Image: { Bytes: imageBytes },
        FaceMatchThreshold: 90,
        MaxFaces: 1,
      });

      const searchResult = await rekognition.send(searchCommand);
      const existingMatch = searchResult.FaceMatches?.[0];

      if (existingMatch && existingMatch.Similarity && existingMatch.Similarity > 90) {
        res.status(409).json({
          error: "Face already registered",
          similarity: existingMatch.Similarity,
        });
        return;
      }

      const command = new IndexFacesCommand({
        CollectionId: aws.collectionId,
        Image: { Bytes: imageBytes },
        ExternalImageId: studentId,
      });

      const response = await rekognition.send(command);
      const faceId = response.FaceRecords?.[0]?.Face?.FaceId;

      if (!faceId) {
        res.status(400).json({ error: "No face detected" });
        return;
      }

      await admin.firestore().collection("students").doc(studentId).update({
        faceId,
        biometricEnabled: true,
      });

      res.json({ success: true, faceId });
      return;

    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Indexing failed",
        details: getErrorMessage(error),
      });
      return;
    }
  }
);

/* ============================
   2️⃣ SEARCH STUDENT FACE
============================ */
export const searchStudentFace = onRequest(
  {
    secrets: [
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      AWS_REGION,
      AWS_COLLECTION_ID,
    ],
  },
  async (req, res): Promise<void> => {
    try {
      const { base64Image } = req.body;

      if (!base64Image) {
        res.status(400).json({ error: "Missing image" });
        return;
      }

      const normalizedBase64 = normalizeBase64Image(base64Image);
      const aws = getAwsConfig();

      const rekognition = new RekognitionClient({
        region: aws.region,
        credentials: aws.credentials,
      });

      const command = new SearchFacesByImageCommand({
        CollectionId: aws.collectionId,
        Image: {
          Bytes: Buffer.from(normalizedBase64, "base64"),
        },
        FaceMatchThreshold: 85,
        MaxFaces: 1,
      });

      const response = await rekognition.send(command);
      const match = response.FaceMatches?.[0];

      if (!match) {
        res.json({ matched: false });
        return;
      }

      const studentId = match.Face?.ExternalImageId;
      const similarity = match.Similarity;

      if (studentId) {
        await admin.firestore().collection("attendance").add({
  subjectType: "student",
  subjectId: studentId,
  method: "face",
  biometric: true,
  similarity,
  mode: "in",
  timestamp: admin.firestore.FieldValue.serverTimestamp(),
});
      }

      res.json({
        matched: true,
        studentId,
        similarity,
      });
      return;

    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Search failed",
        details: getErrorMessage(error),
      });
      return;
    }
  }
);