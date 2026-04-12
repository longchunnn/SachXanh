import clsx from "clsx";

type Props = {
  src?: string;
  alt?: string;
  className?: string;
  roundedClassName?: string;
  heightClassName?: string;
};

export default function ImageFrame({
  src,
  alt,
  className,
  roundedClassName = "rounded-xl",
  heightClassName = "h-52",
}: Props) {
  const wrapperClass = clsx(
    "relative w-full overflow-hidden bg-gray-100 border border-gray-200",
    roundedClassName,
    heightClassName,
    className,
  );

  if (!src) {
    return (
      <div className={wrapperClass}>
        <div className="absolute inset-0 bg-linear-to-br from-gray-100 to-gray-200" />
        <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-500">
          Ảnh (placeholder)
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <img src={src} alt={alt ?? ""} className="w-full h-full object-cover" />
    </div>
  );
}
