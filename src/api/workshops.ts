import axios from "axios";
import { WorkshopsResponse } from "app/entities/workshop";
import { apiErrorMessage } from "ui/common/apiErrors";
import { attachGlobalAuthInterceptor } from "ui/common/globalAuthInterceptor";

const api = attachGlobalAuthInterceptor(axios.create({ withCredentials: true }));

export const listWorkshops = async () => {
  try {
    const response = await api.get<WorkshopsResponse>("/api/workshops");
    return { data: response.data };
  } catch (error: any) {
    return {
      error: {
        message: apiErrorMessage(
          error.response?.data,
          error.message || "Unable to load workshops."
        )
      }
    };
  }
};
