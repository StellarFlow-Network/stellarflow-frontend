import React from "react";
import Nav from "./components/nav";

const page = () => {
  return (
    <main className="border border-white/10 rounded-2xl m-4 min-h-[calc(100vh-2rem)]">
      <Nav />
      <AdminTabBar />
    </main>
  );
};

export default page;