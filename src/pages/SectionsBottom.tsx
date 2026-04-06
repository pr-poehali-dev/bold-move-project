import PortfolioSection from "./PortfolioSection";
import ReviewsSection from "./ReviewsSection";
import FaqSection from "./FaqSection";
import ContactSection from "./ContactSection";

type InViewResult = { ref: React.RefObject<HTMLDivElement>; inView: boolean };

interface Props {
  portfolioRef: InViewResult;
  reviewsRef: InViewResult;
  faqRef: InViewResult;
  citiesRef: InViewResult;
  contactRef: InViewResult;
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  comment: string;
  setComment: (v: string) => void;
  sent: boolean;
  setSent: (v: boolean) => void;
}

export default function SectionsBottom({
  portfolioRef, reviewsRef, faqRef, citiesRef, contactRef,
  name, setName, phone, setPhone, comment, setComment, sent, setSent,
}: Props) {
  return (
    <>
      <PortfolioSection portfolioRef={portfolioRef} />
      <ReviewsSection reviewsRef={reviewsRef} />
      <FaqSection faqRef={faqRef} />
      <ContactSection
        citiesRef={citiesRef}
        contactRef={contactRef}
        name={name}
        setName={setName}
        phone={phone}
        setPhone={setPhone}
        comment={comment}
        setComment={setComment}
        sent={sent}
        setSent={setSent}
      />
    </>
  );
}
