import React, { useState } from "react";

interface FallbackImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackSrc: string;
  alt: string;
}

const FallbackImage: React.FC<FallbackImageProps> = ({
  src,
  fallbackSrc,
  alt,
  ...rest
}) => {
  const [imgSrc, setImgSrc] = useState<string>(src);
  const [hasError, setHasError] = useState<boolean>(false);

  const handleError = () => {
    if (!hasError) {
      setImgSrc(fallbackSrc);
      setHasError(true);
    }
  };

  return <img src={imgSrc} alt={alt} onError={handleError} {...rest} />;
};

export default FallbackImage;
