import { useEffect, useState } from "react";
import API from "../services/api";

export default function useDocuments() {
  const [documents, setDocuments] =
    useState([]);

  const loadDocuments = async () => {
    try {
      const response =
        await API.get("/documents");

      setDocuments(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadDocuments();

    const interval =
      setInterval(loadDocuments, 5000);

    return () =>
      clearInterval(interval);
  }, []);

  return {
    documents,
    reloadDocuments: loadDocuments,
  };
}
