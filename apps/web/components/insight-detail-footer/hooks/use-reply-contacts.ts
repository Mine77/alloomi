"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { IntegrationId } from "@/hooks/use-integrations";
import type { UserContact } from "../types";

interface UseReplyContactsProps {
  currentPlatform: IntegrationId | null;
}

/**
 * Contact management related Hook
 * Handles contact loading, searching, filtering, etc.
 */
export function useReplyContacts({ currentPlatform }: UseReplyContactsProps) {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<UserContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<UserContact[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoadingContacts, setIsLoadingContacts] = useState<boolean>(false);
  const [showContactsList, setShowContactsList] = useState<boolean>(false);
  const [activeRecipientField, setActiveRecipientField] = useState<
    "to" | "cc" | "bcc" | null
  >(null);
  // During runtime, ref may be null before mount; use optional chaining / type assertion to ensure correct types.
  const contactsListRef = useRef<HTMLDivElement | null>(null);

  /**
   * Load contacts
   */
  const loadContacts = useCallback(async () => {
    if (!currentPlatform) return;
    setIsLoadingContacts(true);
    try {
      const url = new URL("/api/bot/contact", window.location.origin);
      url.searchParams.set("platform", currentPlatform);
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(response.statusText);
      const data = (await response.json()) as {
        contacts: UserContact[];
      };
      setContacts(data.contacts ?? []);
      setFilteredContacts(data.contacts ?? []);
    } catch (error) {
      console.error("Failed to fetch contacts", error);
      toast.error(
        t(
          "common.contactFetchFailed",
          "Unable to load contact list right now.",
        ),
      );
    } finally {
      setIsLoadingContacts(false);
    }
  }, [currentPlatform, t]);

  /**
   * Load contacts when platform changes
   */
  useEffect(() => {
    if (!currentPlatform) {
      setContacts([]);
      setFilteredContacts([]);
      return;
    }
    void loadContacts();
  }, [currentPlatform, loadContacts]);

  /**
   * Filter contacts
   */
  useEffect(() => {
    if (!searchQuery) {
      setFilteredContacts(contacts);
      return;
    }
    const lowerQuery = searchQuery.toLowerCase();
    const matchedContacts = contacts.filter((contact) =>
      contact.contactName.toLowerCase().includes(lowerQuery),
    );
    const exactMatches = matchedContacts.filter(
      (contact) => contact.contactName.toLowerCase() === lowerQuery,
    );
    const partialMatches = matchedContacts.filter(
      (contact) => contact.contactName.toLowerCase() !== lowerQuery,
    );
    setFilteredContacts([...exactMatches, ...partialMatches]);
  }, [contacts, searchQuery]);

  /**
   * Handle clicking outside to close contacts list
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInList = contactsListRef.current?.contains(target);
      if (!isInList) {
        setShowContactsList(false);
        setActiveRecipientField(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return {
    contacts,
    filteredContacts,
    searchQuery,
    setSearchQuery,
    isLoadingContacts,
    showContactsList,
    setShowContactsList,
    activeRecipientField,
    setActiveRecipientField,
    contactsListRef,
  };
}
