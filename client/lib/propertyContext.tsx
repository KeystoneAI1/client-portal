import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/hooks/useAuth";

export interface Property {
  id: string;
  name: string;
  surname?: string;
  companyName?: string;
  addressLine1: string;
  addressLine2?: string;
  town: string;
  county?: string;
  postcode: string;
  isPrimaryAddress: boolean;
  servicePlans?: Array<{
    id: string;
    description: string;
    expireDate: string;
  }>;
}

interface PropertyContextType {
  properties: Property[];
  selectedProperty: Property | null;
  isLoading: boolean;
  selectProperty: (property: Property) => void;
  refreshProperties: () => Promise<void>;
}

const PropertyContext = createContext<PropertyContextType | null>(null);

export function useProperty(): PropertyContextType {
  const context = useContext(PropertyContext);
  if (!context) {
    throw new Error("useProperty must be used within a PropertyProvider");
  }
  return context;
}

interface PropertyProviderProps {
  children: ReactNode;
}

export function PropertyProvider({ children }: PropertyProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshProperties = useCallback(async () => {
    if (!isAuthenticated || !user?.accountNumber) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        new URL(`/api/commusoft/customer/${user.accountNumber}/workaddresses`, getApiUrl()).toString()
      );

      if (!response.ok) {
        throw new Error("Failed to fetch properties");
      }

      const data = await response.json();
      const workAddresses = data.workAddress || [];

      const customerResponse = await fetch(
        new URL(`/api/commusoft/customer/${user.accountNumber}`, getApiUrl()).toString()
      );
      
      let primaryProperty: Property | null = null;
      
      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        const customer = customerData.Customer || customerData;
        
        primaryProperty = {
          id: customer.id?.toString() || user.accountNumber,
          name: customer.name || "",
          surname: customer.surname || "",
          companyName: customer.companyname || "",
          addressLine1: customer.addressline1 || "",
          addressLine2: customer.addressline2 || "",
          town: customer.town || "",
          county: customer.county || "",
          postcode: customer.postcode || "",
          isPrimaryAddress: true,
        };
      }

      const mappedProperties: Property[] = workAddresses.map((addr: any) => ({
        id: addr.id?.toString(),
        name: addr.name || "",
        surname: addr.surname || "",
        companyName: addr.companyname || "",
        addressLine1: addr.addressline1 || "",
        addressLine2: addr.addressline2 || "",
        town: addr.town || "",
        county: addr.county || "",
        postcode: addr.postcode || "",
        isPrimaryAddress: false,
        servicePlans: addr.servicePlans?.map((sp: any) => ({
          id: sp.id?.toString(),
          description: sp.description,
          expireDate: sp.expiredate,
        })),
      }));

      const allProperties = primaryProperty 
        ? [primaryProperty, ...mappedProperties]
        : mappedProperties;

      setProperties(allProperties);

      if (!selectedProperty && allProperties.length > 0) {
        setSelectedProperty(allProperties[0]);
      }
    } catch (error) {
      console.error("Failed to load properties:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.accountNumber, selectedProperty]);

  useEffect(() => {
    if (isAuthenticated && user?.accountNumber) {
      refreshProperties();
    } else {
      setProperties([]);
      setSelectedProperty(null);
    }
  }, [isAuthenticated, user?.accountNumber]);

  const selectProperty = useCallback((property: Property) => {
    setSelectedProperty(property);
  }, []);

  return (
    <PropertyContext.Provider
      value={{
        properties,
        selectedProperty,
        isLoading,
        selectProperty,
        refreshProperties,
      }}
    >
      {children}
    </PropertyContext.Provider>
  );
}
