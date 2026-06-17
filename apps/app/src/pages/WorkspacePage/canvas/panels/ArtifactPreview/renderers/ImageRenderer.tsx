type ImageRendererProps = {
  src: string;
  alt?: string;
};

export const ImageRenderer = ({ src, alt }: ImageRendererProps) => (
  <div className="flex max-h-96 items-center justify-center overflow-auto rounded-lg bg-surface-2/60 p-3">
    <img
      className="max-h-full max-w-full object-contain"
      src={src}
      alt={alt ?? "artifact-image"}
      data-testid="artifact-renderer-image"
    />
  </div>
);
