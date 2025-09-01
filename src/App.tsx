import React, { useEffect, useState } from 'react';
import './App.css';
import MapView from './components/MapView';

function App() {
  const [isVisible, setIsVisible] = useState(false);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleStartAnalysis = () => {
    setShowMap(true);
  };

  const handleBackToHome = () => {
    setShowMap(false);
  };

  if (showMap) {
    return <MapView onBack={handleBackToHome} />;
  }

  return (
    <div className="min-h-screen bg-dark-bg text-white">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-deep-purple via-dark-bg to-electric-blue animate-gradient-xy"></div>
        <div className="absolute inset-0 bg-dark-bg opacity-80"></div>
        
        {/* Content */}
        <div className={`relative z-10 text-center px-4 max-w-6xl mx-auto transition-all duration-1000 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-electric-blue to-purple-400 bg-clip-text text-transparent">
            Find Hidden Real Estate Opportunities with AI
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Analyze thousands of panoramic street views to identify properties with high acquisition potential
          </p>
          <button 
            onClick={handleStartAnalysis}
            className="bg-gradient-to-r from-electric-blue to-deep-purple hover:from-deep-purple hover:to-electric-blue text-white font-bold py-4 px-8 rounded-lg text-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-electric-blue/25"
          >
            Start Free Analysis
          </button>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-electric-blue rounded-full flex justify-center">
            <div className="w-1 h-3 bg-electric-blue rounded-full mt-2"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 bg-gradient-to-r from-electric-blue to-purple-400 bg-clip-text text-transparent">
            Powerful AI-Driven Features
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="bg-dark-card/50 backdrop-blur-sm border border-electric-blue/20 rounded-xl p-6 hover:border-electric-blue/50 transition-all duration-300 transform hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-r from-electric-blue to-deep-purple rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-electric-blue">Draw Custom Search Areas</h3>
              <p className="text-gray-300">Define precise geographic boundaries with polygon drawing tools on interactive maps</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-dark-card/50 backdrop-blur-sm border border-electric-blue/20 rounded-xl p-6 hover:border-electric-blue/50 transition-all duration-300 transform hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-r from-electric-blue to-deep-purple rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-electric-blue">AI-Powered Analysis</h3>
              <p className="text-gray-300">Advanced computer vision examines panoramic images for signs of neglect and opportunity</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-dark-card/50 backdrop-blur-sm border border-electric-blue/20 rounded-xl p-6 hover:border-electric-blue/50 transition-all duration-300 transform hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-r from-electric-blue to-deep-purple rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-electric-blue">Instant Property Insights</h3>
              <p className="text-gray-300">Get immediate analysis results identifying high-potential acquisition targets</p>
            </div>

            {/* Feature 4 */}
            <div className="bg-dark-card/50 backdrop-blur-sm border border-electric-blue/20 rounded-xl p-6 hover:border-electric-blue/50 transition-all duration-300 transform hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-r from-electric-blue to-deep-purple rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-electric-blue">Bulk Processing</h3>
              <p className="text-gray-300">Analyze hundreds of properties in minutes with automated batch processing</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 bg-dark-card/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 bg-gradient-to-r from-electric-blue to-purple-400 bg-clip-text text-transparent">
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center relative">
              <div className="w-20 h-20 bg-gradient-to-r from-electric-blue to-deep-purple rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                1
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-electric-blue">Draw Your Search Area</h3>
              <p className="text-gray-300 text-lg">Use our intuitive map interface to define custom search boundaries with polygon drawing tools</p>
              {/* Arrow */}
              <div className="hidden md:block absolute top-10 -right-4 text-electric-blue">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>

            {/* Step 2 */}
            <div className="text-center relative">
              <div className="w-20 h-20 bg-gradient-to-r from-electric-blue to-deep-purple rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                2
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-electric-blue">AI Scans All Views</h3>
              <p className="text-gray-300 text-lg">Our AI processes all available panoramic street views within your defined area automatically</p>
              {/* Arrow */}
              <div className="hidden md:block absolute top-10 -right-4 text-electric-blue">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-electric-blue to-deep-purple rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                3
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-electric-blue">Get Ranked Opportunities</h3>
              <p className="text-gray-300 text-lg">Receive a prioritized list of acquisition opportunities with detailed analysis and insights</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark-card/50 py-12 px-4 border-t border-electric-blue/20">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4 text-electric-blue">PropertyScout AI</h3>
              <p className="text-gray-300">Revolutionary AI-powered real estate acquisition platform</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Product</h4>
              <ul className="space-y-2 text-gray-300">
                <li><button className="hover:text-electric-blue transition-colors text-left">Features</button></li>
                <li><button className="hover:text-electric-blue transition-colors text-left">Pricing</button></li>
                <li><button className="hover:text-electric-blue transition-colors text-left">API</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Company</h4>
              <ul className="space-y-2 text-gray-300">
                <li><button className="hover:text-electric-blue transition-colors text-left">About</button></li>
                <li><button className="hover:text-electric-blue transition-colors text-left">Blog</button></li>
                <li><button className="hover:text-electric-blue transition-colors text-left">Careers</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Support</h4>
              <ul className="space-y-2 text-gray-300">
                <li><button className="hover:text-electric-blue transition-colors text-left">Help Center</button></li>
                <li><button className="hover:text-electric-blue transition-colors text-left">Contact</button></li>
                <li><button className="hover:text-electric-blue transition-colors text-left">Privacy</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-electric-blue/20 mt-8 pt-8 text-center text-gray-300">
            <p>&copy; 2024 PropertyScout AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
