const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg)$/i;

function isAcceptedUploadFile(file: File): boolean {
  if (file.type.startsWith('image/') || file.type === 'application/pdf') {
    return true;
  }
  if (!file.type && IMAGE_EXTENSIONS.test(file.name)) {
    return true;
  }
  return false;
}

/**
 * Convert browser FileList / File[] into survey upload file objects (web only).
 */
export async function filesFromWebFileList(files: FileList | File[]): Promise<
  {
    uri: string;
    name: string;
    size: number;
    mimeType: string;
    base64: string;
    base64Data: string;
    isNew: boolean;
    timestamp: number;
  }[]
> {
  const list = Array.from(files as FileList | File[]);

  return Promise.all(
    list
      .filter(isAcceptedUploadFile)
      .map(async (file) => {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsDataURL(file);
        });

        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;

        return {
          uri: URL.createObjectURL(file),
          name: file.name,
          size: file.size,
          mimeType: file.type || 'image/jpeg',
          base64,
          base64Data,
          isNew: true,
          timestamp: Date.now(),
        };
      })
  );
}
