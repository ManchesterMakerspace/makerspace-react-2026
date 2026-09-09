import axios from "axios";
import { PaymentMethodCancellationImpact } from "app/entities/paymentMethod";
import { apiErrorMessage } from "ui/common/apiErrors";
import { attachGlobalAuthInterceptor } from "ui/common/globalAuthInterceptor";

const token = () => {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
};

const api = attachGlobalAuthInterceptor(axios.create({ withCredentials: true }));
api.interceptors.request.use(config => {
  config.headers.set("X-XSRF-TOKEN", token());
  config.headers.set("Content-Type", "application/json");
  return config;
});

const wrap = async <T>(request: Promise<any>) => {
  try {
    const response = await request;
    return { data: response.data, response };
  } catch (err: any) {
    return {
      error: { message: apiErrorMessage(err.response?.data, err.message || "Request failed") },
      response: err.response
    };
  }
};

export const getPaymentMethodCancellationImpact = ({ id }: { id: string }) =>
  wrap<PaymentMethodCancellationImpact>(api.get(`/api/billing/payment_methods/${id}/cancellation_impact`));
