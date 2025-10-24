import React from "react";
import { Toaster } from "react-hot-toast";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AppWrapper } from "./context/AppContext";
import Navbar from "./components/Navbar";
import HomePage from "./components/HomePage";
import CreateMarketPage from "./pages/CreateMarketPage";
import MarketDetailPage from "./pages/MarketDetailPage";
import RechargePage from "./components/RechargePage";

function App() {

    return (
        <AppWrapper>
            <Router>
                <div className="min-h-screen">
                    {/* Navbar is a descendant of AppWrapper and can use useAppContext normally */}
                    <Navbar />

                    <div className="container mx-auto px-4 py-6">
                        <Routes>
                            <Route path="/" element={<HomePage />} />
                            <Route path="/create-market" element={<CreateMarketPage />} />
                            {/* Added: Market detail page route, dynamically receives marketId */}
                            <Route path="/market/:id" element={<MarketDetailPage />} />
                            <Route path="/recharge" element={<RechargePage />} />
                        </Routes>

                        <Toaster position="top-right" />
                    </div>
                </div>
            </Router>
        </AppWrapper>
    );
}

export default App;