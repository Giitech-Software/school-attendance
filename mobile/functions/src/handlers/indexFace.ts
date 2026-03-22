// functions/src/handlers/indexFace.ts

import { Request, Response } from "express";
import * as admin from "firebase-admin";
import AWS from "aws-sdk";

admin.initializeApp();
const db = admin.firestore();

// Load AWS credentials from Firebase Secrets
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION || "us-east-1";
const collectionId = process.env.AWS_COLLECTION_ID || "school-attendance-staff";

// Initialize Rekognition client
const rekognition = new AWS.Rekognition({
  accessKeyId,
  secretAccessKey,
  region,
});

export const indexFaceHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { staffId, imageBase64 } = req.body;

    if (!staffId || !imageBase64) {
      res.status(400).json({ error: "staffId and imageBase64 required" });
      return;
    }

    // Convert base64 → Buffer
    const imageBuffer = Buffer.from(imageBase64, "base64");

    // Index face in AWS Rekognition
    const result = await rekognition
      .indexFaces({
        CollectionId: collectionId,
        Image: { Bytes: imageBuffer },
        ExternalImageId: staffId,
        DetectionAttributes: [],
      })
      .promise();

    if (!result.FaceRecords || result.FaceRecords.length === 0) {
      res.status(400).json({ success: false, message: "No face detected" });
      return;
    }

    // Save faceId to Firestore
    const faceId = result.FaceRecords[0].Face?.FaceId;
    await db.collection("staff").doc(staffId).set(
      { biometricEnabled: true, faceId },
      { merge: true }
    );

    res.json({ success: true, faceId });
    return;
  } catch (error: any) {
    console.error("indexFace error:", error);
    res.status(500).json({ error: error.message });
    return;
  }
};
