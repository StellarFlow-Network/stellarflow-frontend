import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { NetworkHealthWidget } from "./NetworkHealthWidget";
import { CongestionFeeAlert } from "./CongestionFeeAlert";

// Mock Chart.js component to prevent canvas rendering errors in Node test environment
jest.mock("react-chartjs-2", () => ({
  Line: () => <div data-testid="line-chart-mock">Line Chart Mock</div>,
}));

describe("NetworkHealthWidget & CongestionFeeAlert", () => {
  it("renders NetworkHealthWidget header and KPI cards", () => {
    render(<NetworkHealthWidget title="Soroban Network Gas & Congestion" />);

    expect(screen.getByText("Soroban Network Gas & Congestion")).toBeInTheDocument();
    expect(screen.getByText("Base Inclusion Fee")).toBeInTheDocument();
    expect(screen.getByText("Congestion Meter")).toBeInTheDocument();
    expect(screen.getByText("Est. Confirmation Speed")).toBeInTheDocument();
    expect(screen.getByText("24-Hour Inclusion Fee Trend")).toBeInTheDocument();
  });

  it("toggles test high traffic simulation when button is clicked", () => {
    render(<NetworkHealthWidget />);

    const toggleBtn = screen.getByText("Test High Traffic");
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.getByText("Simulating High")).toBeInTheDocument();
    expect(screen.getByText("High Congestion")).toBeInTheDocument();
  });

  it("renders CongestionFeeAlert when forced or in high congestion state", () => {
    render(<CongestionFeeAlert forceShow={true} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("High Network Congestion Detected")).toBeInTheDocument();
    expect(screen.getByText("Fee Alert 🚨")).toBeInTheDocument();
  });

  it("dismisses CongestionFeeAlert when close button is clicked", () => {
    render(<CongestionFeeAlert forceShow={true} dismissable={true} />);

    const dismissButton = screen.getByLabelText("Dismiss alert");
    fireEvent.click(dismissButton);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders compact variant of CongestionFeeAlert", () => {
    render(<CongestionFeeAlert forceShow={true} compact={true} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("High Congestion:")).toBeInTheDocument();
  });
});
