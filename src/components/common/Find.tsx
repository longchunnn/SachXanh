import { useEffect, useState } from "react";

interface FindProps {
  categories: string[];
  authors: string[];
  selectedCategory: string;
  selectedAuthor: string;
  minPrice: string;
  maxPrice: string;
  onCategoryChange: (category: string) => void;
  onAuthorChange: (author: string) => void;
  onPriceApply: (from: string, to: string) => void;
}

function Find({
  categories,
  authors,
  selectedCategory,
  selectedAuthor,
  minPrice,
  maxPrice,
  onCategoryChange,
  onAuthorChange,
  onPriceApply,
}: FindProps) {
  const [priceFrom, setPriceFrom] = useState(minPrice);
  const [priceTo, setPriceTo] = useState(maxPrice);

  useEffect(() => {
    setPriceFrom(minPrice);
  }, [minPrice]);

  useEffect(() => {
    setPriceTo(maxPrice);
  }, [maxPrice]);

  const handleCategoryClick = (category: string) => {
    onCategoryChange(selectedCategory === category ? "" : category);
  };

  const handleAuthorClick = (author: string) => {
    onAuthorChange(selectedAuthor === author ? "" : author);
  };

  const handlePriceApply = () => {
    onPriceApply(priceFrom, priceTo);
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handlePriceApply();
    }
  };

  return (
    <aside className="hidden lg:block bg-white border border-gray-100 rounded-2xl sticky top-24 w-72">
      <div className="font-bold text-gray-800 mb-3 pl-4 pt-4">Thể loại</div>
      <div>
        {categories.map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => handleCategoryClick(c)}
            className={`pl-4 w-full text-left text-sm px-2 py-3 transition-colors ${
              selectedCategory === c
                ? "text-teal-800 bg-teal-50 font-semibold"
                : "text-gray-700 hover:text-teal-800 hover:bg-gray-100"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="border-t border-gray-100 my-4" />

      <div className="font-bold text-gray-800 mb-3 pl-4">Tác giả</div>
      <div>
        {authors.map((a) => (
          <button
            type="button"
            key={a}
            onClick={() => handleAuthorClick(a)}
            className={`pl-4 w-full text-left text-sm px-2 py-3 transition-colors ${
              selectedAuthor === a
                ? "text-teal-800 bg-teal-50 font-semibold"
                : "text-gray-700 hover:text-teal-800 hover:bg-gray-100"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="border-t border-gray-100 my-4" />

      <div className="font-bold text-gray-800 mb-3 pl-4 ">Khoảng giá</div>
      <div className="grid grid-cols-2 gap-2 px-2">
        <input
          type="text"
          inputMode="numeric"
          value={priceFrom}
          onChange={(e) => setPriceFrom(e.target.value)}
          onKeyDown={handlePriceKeyDown}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-100"
          placeholder="VD: 100000"
        />
        <input
          type="text"
          inputMode="numeric"
          value={priceTo}
          onChange={(e) => setPriceTo(e.target.value)}
          onKeyDown={handlePriceKeyDown}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-100"
          placeholder="VD: 300000"
        />
      </div>
      <p className="px-2 mt-2 text-xs text-gray-500">
        Nhập số tiền dạng 100000, 100.000 hoặc 100,000 (đơn vị VND)
      </p>
      <button
        type="button"
        onClick={handlePriceApply}
        className="mt-4 w-full bg-teal-800 hover:bg-teal-700 text-white font-semibold text-sm py-2 rounded-lg transition-colors"
      >
        Áp dụng
      </button>

      <div className="border-t border-gray-100 my-4" />
    </aside>
  );
}

export default Find;
