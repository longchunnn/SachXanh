import { BrowserRouter, useLocation } from "react-router-dom";
import { Provider } from "react-redux";
import { ToastContainer } from "react-toastify";
import AppRoutes from "./routes/AppRoutes";
import { store } from "./app/store";
import "react-toastify/dist/ReactToastify.css";
import SupportWidget from "./components/support/SupportWidget";
import ChatbotWidget from "./components/chatbot/ChatbotWidget";

function GlobalWidgets() {
  const location = useLocation();
  const isStaffArea = location.pathname.startsWith("/staff");

  if (isStaffArea) {
    return null;
  }

  return (
    <>
      <SupportWidget />
      <ChatbotWidget />
    </>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppRoutes />
        <GlobalWidgets />
        <ToastContainer
          position="top-right"
          autoClose={1500}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
          draggable
          theme="light"
          toastClassName="sx-toast"
          progressClassName="sx-toast-progress"
        />
      </BrowserRouter>
    </Provider>
  );
}
