import React from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import LoginModal from "./LoginModal";
import { requestFaucet } from "../chainApi";
import toast from "react-hot-toast";
import logoImg from "../assets/Zama  DApp-logo.png";
import { Link } from 'react-router-dom';

const Navbar = () => {
    const navigate = useNavigate();
    const {
        isLoginOpen,
        setIsLoginOpen,
        isLoggedIn,
        userAddress,
        setIsLoggedIn,
        setUserAddress,
        isConnecting, // Added: Assume context has connecting state (optional)
    } = useAppContext();

    // Click "Log In" button: Open login modal (keep original)
    const handleLogin = () => {
        setIsLoginOpen(true);
    };

    // Logout: Reset global state + clear Token (keep original)
    const handleLogout = () => {
        setIsLoggedIn(false);
        setUserAddress("");
        localStorage.removeItem("zamaToken");
        toast.success("Logged out successfully"); // Optimized: Use toast instead of alert for better UX
    };

    // Added: Claim Faucet (test tokens)
    const handleFaucet = async () => {
        if (!userAddress) {
            toast.error("Please connect your wallet first");
            return;
        }
        try {
            toast.loading("Claiming tokens...");
            await requestFaucet(); // Call on-chain claim method
            toast.dismiss();
            toast.success("Test tokens claimed successfully!");
        } catch (err) {
            toast.dismiss();
            toast.error(`Claim failed: ${err.message}`);
        }
    };

    // Added: Navigate to recharge page
    const handleRecharge = () => {
        navigate("/recharge"); // Navigate to recharge page
    };

    return (
        <>
            {/* Navbar UI (keep original structure, add new buttons) */}
            <header className="sticky top-0 z-40 bg-zama-dark/90 backdrop-blur-md border-b border-zama-primary/20">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    {/* Brand Logo (keep unchanged) */}
                    <div className="flex items-center space-x-2">
                        <Link to="/" className="flex items-center space-x-2">
                            <div
                                className="w-10 h-10 rounded-lg bg-gradient-to-r from-zama-primary to-zama-secondary flex items-center justify-center p-1">
                                {/* Display logo with img tag */}
                                <img
                                    src={logoImg}
                                    alt="AegisPredict Logo"
                                    className="w-full h-full object-contain" // Ensure image fits container, maintain aspect ratio
                                />
                            </div>
                            <h1 className="text-xl font-bold gradient-text">Zama<span
                                className="text-white ml-1">Predict</span></h1>
                        </Link>
                    </div>

                    {/* Desktop navigation links (keep unchanged) */}
                    <nav className="hidden md:flex items-center space-x-6">
                        <a href="#" className="nav-link">Politics</a>
                        <a href="#" className="nav-link">Sports</a>
                        <a href="#" className="nav-link">Tech</a>
                        <a href="#" className="nav-link">Economy</a>
                        <a href="#" className="nav-link">Entertainment</a>
                    </nav>

                    {/* Login/Sign Up button area (core adjustment: add Faucet and recharge buttons) */}
                    <div className="flex items-center space-x-4">
                        {isLoggedIn ? (
                            // Logged in: Show 「Faucet + Recharge + User Address + Logout」
                            <div className="flex items-center space-x-3 flex-wrap">
                                {/* Added: Faucet button (testnet only) */}
                                <button
                                    onClick={handleFaucet}
                                    disabled={isConnecting} // Disabled when connecting
                                    className="px-3 py-1.5 text-sm rounded bg-purple-600 hover:bg-purple-700 text-white transition"
                                >
                                    {isConnecting ? "Claiming..." : "Faucet"}
                                </button>

                                {/* Added: Recharge button */}
                                <button
                                    onClick={handleRecharge}
                                    className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white transition"
                                >
                                    Deposit
                                </button>

                                {/* User address (keep original, adjust style to fit new buttons) */}
                                <span className="text-white text-sm hidden sm:inline-block">
                                    {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
                                </span>

                                {/* Logout button (keep original) */}
                                <button
                                    className="text-white text-sm hover:text-gray-300"
                                    onClick={handleLogout}
                                >
                                    Logout
                                </button>
                            </div>
                        ) : (
                            // Not logged in: Show 「Log In + Sign Up」 buttons (keep original)
                            <>
                                <button className="hidden md:block btn-outline" onClick={handleLogin}>Log In</button>
                                <button className="btn-primary">Sign Up</button>
                            </>
                        )}

                        {/* Mobile menu button (keep original) */}
                        <button className="md:hidden text-white text-xl">
                            <i className="fa fa-bars"></i>
                        </button>
                    </div>
                </div>
            </header>

            {/* Login modal (keep original) */}
            <LoginModal />
        </>
    );
};

export default Navbar;