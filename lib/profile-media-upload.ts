import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getFirebaseDb, getFirebaseStorage } from "@/lib/firebase";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

export type ProfileMediaKind = "avatar" | "cover";

function storagePathFor(uid: string, kind: ProfileMediaKind, ext: string): string {
  return `users/${uid}/profile/${kind}.${ext}`;
}

export async function uploadProfileMedia(
  uid: string,
  kind: ProfileMediaKind,
  file: File
): Promise<{ ok: true; path: string; downloadUrl: string } | { ok: false; message: string }> {
  const storage = getFirebaseStorage();
  const db = getFirebaseDb();
  if (!storage || !db) {
    return { ok: false, message: "Firebase に接続できません。" };
  }
  if (!ACCEPT.includes(file.type)) {
    return { ok: false, message: "JPEG / PNG / WebP の画像を選んでください。" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, message: "ファイルは 5MB 以下にしてください。" };
  }

  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = storagePathFor(uid, kind, ext);
  const field = kind === "avatar" ? "avatarPath" : "coverPath";

  try {
    await uploadBytes(ref(storage, path), file, { contentType: file.type });
    const downloadUrl = await getDownloadURL(ref(storage, path));
    await updateDoc(doc(db, "users", uid), {
      [field]: path,
      updatedAt: serverTimestamp(),
    });
    return { ok: true, path, downloadUrl };
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "permission-denied" || code === "storage/unauthorized") {
      return { ok: false, message: "アップロードが拒否されました。" };
    }
    return { ok: false, message: "アップロードに失敗しました。" };
  }
}
