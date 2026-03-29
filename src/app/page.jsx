import React from "react";
import Nav from "./components/nav";

const page = () => {
  return (
    <main className="min-h-screen bg-[#f5f5f5]">
      <Nav />

      <section className="px-6 py-6 md:px-10">
        <div className="mx-auto w-full max-w-7xl rounded-2xl border border-[#D9D9D9] bg-white px-6 py-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <p className="text-lg font-semibold text-[#111827]">NGN/XLM (24h)</p>
            <p className="text-lg font-semibold text-[#111827]">750.50 NGN/XLM</p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default page;