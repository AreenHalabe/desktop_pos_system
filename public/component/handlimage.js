    // دالة لضغط الصورة وتحويلها WebP
export async function compressWithLibrary(file) {
    //   const options = {
    //     maxSizeMB: 0.15,        // 150 KB
    //     maxWidthOrHeight: 1000, // أقصى عرض أو ارتفاع
    //     useWebWorker: true,     // استخدم Web Worker لتسريع المعالجة
    //     // initialQuality: 0.85,   // جودة البداية
    //     initialQuality: 0.92,
    //     fileType: "image/webp", // تحويل WebP
    //     alwaysKeepResolution: false // يسمح بتغيير الأبعاد للوصول للهدف
    //   };
    const options = {
    maxSizeMB: 0.15,          // 150 KB
    maxWidthOrHeight: 1200,   // توازن ممتاز للتفاصيل
    initialQuality: 0.8,      // Sweet spot لصور الأكل
    useWebWorker: true,
    fileType: "image/webp",
    alwaysKeepResolution: false
    };

  try {
    const compressedFile = await imageCompression(file, options);
    console.log("Compressed size:", (compressedFile.size / 1024).toFixed(1), "KB");
    return compressedFile;
  } catch (err) {
    console.error("Compression error:", err);
    return file; // لو صار خطأ نرجع الصورة الأصلية
  }
}