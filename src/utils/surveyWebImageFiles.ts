const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg)$/i;

function isAcceptedUploadFile(file: File): boolean {
  if (file.type.startsWith('image/') || file.type === 'application/pdf') {
    return true;
  }
  if (!file.type) {
    if (!file.name || IMAGE_EXTENSIONS.test(file.name)) {
      return true;
    }
  }
  return false;
}

function extractImageUrlFromHtml(html: string): string | null {
  if (!html) return null;
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch?.[1] ?? null;
}

function extractUrlFromUriList(uriList: string): string | null {
  if (!uriList) return null;
  const line = uriList
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry && !entry.startsWith('#'));
  return line ?? null;
}

async function fetchImageAsFile(url: string): Promise<File | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) {
      return null;
    }

    const extension = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    return new File([blob], `dropped-image-${Date.now()}.${extension}`, { type: blob.type });
  } catch {
    return null;
  }
}

/**
 * Collect image files from a browser DataTransfer (desktop files, or images dragged from tabs).
 */
export async function filesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const collected: File[] = [];

  if (dataTransfer.files?.length) {
    for (const file of Array.from(dataTransfer.files)) {
      if (isAcceptedUploadFile(file)) {
        collected.push(file);
      }
    }
  }

  if (collected.length === 0 && dataTransfer.items?.length) {
    for (const item of Array.from(dataTransfer.items)) {
      if (item.kind !== 'file') {
        continue;
      }
      const file = item.getAsFile();
      if (file && isAcceptedUploadFile(file)) {
        collected.push(file);
      }
    }
  }

  if (collected.length === 0) {
    const html = dataTransfer.getData('text/html');
    const uriList = dataTransfer.getData('text/uri-list');
    const plain = dataTransfer.getData('text/plain')?.trim();

    const url =
      extractImageUrlFromHtml(html) ||
      extractUrlFromUriList(uriList) ||
      (plain && /^https?:\/\//i.test(plain) ? plain : null) ||
      (plain && (plain.startsWith('data:image/') || plain.startsWith('blob:')) ? plain : null);

    if (url) {
      const file = await fetchImageAsFile(url);
      if (file) {
        collected.push(file);
      }
    }
  }

  return collected;
}

export type SurveyWebUploadFile = {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  base64: string;
  base64Data: string;
  isNew: boolean;
  timestamp: number;
};

/**
 * Convert browser FileList / File[] into survey upload file objects (web only).
 */
export async function filesFromWebFileList(
  files: FileList | File[],
): Promise<SurveyWebUploadFile[]> {
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
      }),
  );
}

/**
 * Handle a web drag-and-drop DataTransfer and return survey upload file objects.
 */
export async function surveyFilesFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<{ files: SurveyWebUploadFile[]; hadUrlDrag: boolean }> {
  const rawFiles = await filesFromDataTransfer(dataTransfer);
  const hadUrlDrag =
    rawFiles.length === 0 &&
    Boolean(
      dataTransfer.getData('text/html') ||
        dataTransfer.getData('text/uri-list') ||
        dataTransfer.getData('text/plain'),
    );

  const files = await filesFromWebFileList(rawFiles);
  return { files, hadUrlDrag };
}
