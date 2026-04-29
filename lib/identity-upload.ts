import { ref, uploadBytes } from "firebase/storage";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getFirebaseDb, getFirebaseStorage } from "@/lib/firebase";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

export async function submitIdentityDocument(
  uid: string,
  file: File
): Promise<{ ok: true } | { ok: false; message: string }> {
  const storage = getFirebaseStorage();
  const db = getFirebaseDb();
  if (!storage || !db) {
    return { ok: false, message: "Firebase Storage / Firestore に接続できません。設定を確認してください。" };
  }
  if (!ACCEPT.includes(file.type)) {
    return { ok: false, message: "JPEG / PNG / WebP の画像を選んでください。" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, message: "ファイルは 5MB 以下にしてください。" };
  }

  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const name = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const storagePath = `users/${uid}/identity/${name}`;
  const storageRef = ref(storage, storagePath);

  try {
    await uploadBytes(storageRef, file, { contentType: file.type });
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      identityStatus: "pending",
      idDocumentPath: storagePath,
      identitySubmittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "permission-denied" || code === "storage/unauthorized") {
      return { ok: false, message: "アップロードが拒否されました。Storage ルールとログイン状態を確認してください。" };
    }
    return { ok: false, message: "アップロードに失敗しました。" };
  }
}
