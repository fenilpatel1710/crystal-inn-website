# LumenPMS (CheckinPro) — Website Integration Brief

Oct 25, 2026 · @Someone

## Purpose and how to use this brief

LumenPMS is a hotel property-management system. Its code lives in the `CheckinPro` repository (GitHub org `Opulent-Hospitality`; this brief was written from branch `feature_iteration11_enhancement`, commit `5bc34fb`). Hotel staff use it for check-in and check-out, room bookings, rates, payments, guests, shifts and reports. The goal is to connect a new public website to it, for example to show rooms, rates and availability and to take bookings, without exposing staff-only data.

**Instructions for the AI reading this:**

- Everything here comes from the source code. Names of classes, routes and fields are exact. Where the code could not confirm something, it is marked as an open question.
- No passwords, connection strings or other secrets are included. Config keys are named, values are not.
- Treat the existing API as a staff API (see the Security findings section). Design the website integration as a new, separate public layer inside this solution, following the conventions in the API conventions section.
- When you propose code, match the existing pattern: a controller calls a service interface, the service calls a repository interface, the repository uses EF Core on `CheckinProContext`, and everything returns an `Ardalis.Result`.

## Solution architecture

LumenPMS is one ASP.NET Core 8 app (`CheckinPro.WebApp`) that serves both a Blazor WebAssembly staff UI and a REST API under `/api`. The UI calls that same API over HTTP. A request goes controller → service → repository → EF Core (`CheckinProContext`) → SQL Server.

| Project | Type | Role |
| --- | --- | --- |
| `CheckinPro.WebApp/CheckinPro.WebApp` | ASP.NET Core Web (net8.0) | Host. `Program.cs`, 13 API controllers in `Controllers/`, cookie auth, Swagger, DI registrations, `Providers/` (`SessionUserService`, `PasswordService`). |
| `CheckinPro.WebApp/CheckinPro.WebApp.Client` | Blazor WebAssembly | Staff UI (166 .cs/.razor files). Pages under `Pages/` (Dashboard, Hotel, Guest, HouseKeeping, Reports, User, Role, …). Calls the API through Refit interfaces in `IServices/`, base URL = `<site>/api`. UI kit: Radzen.Blazor. |
| `CheckinPro.Services` | Class library | Business layer. One `XService : IXService` per area (15). Wraps repository calls with logging and try/catch. |
| `CheckinPro.Repositories` | Class library | Data access and most business logic (16 repositories + `IRepository/` interfaces). Uses EF Core LINQ plus a few stored procedures. Builds PDF reports with iText 7. |
| `CheckinPro.DAL.SQL` | Class library | EF Core 8.0.15 database-first model in `CheckinProDBContext/`: `CheckinProContext` + 32 `tbl*` entity classes, scaffolded with `-UseDatabaseNames`. |
| `CheckinPro.SQL.DB` | SQL Server database project (.sqlproj) | Schema source: 31 tables in `dbo/Tables`, 5 stored procedures in `dbo/Stored Procedures`. |
| `CheckinPro.WebApi.Models` | Class library | Request/response DTOs used by the API, services and repositories (`HotelModels`, `HotelRoomBookingModels`, `GuestModels`, …). |
| `CheckinPro.WebApp.Models` | Class library | Mirror DTOs used by the Blazor client. |
| `CheckinPro.Common.Models` | Class library | Shared constants and small shared models (for example `AuditInfoModel`). |
| `CheckinPro.Report.Templates` | Razor class library | HTML templates and report models rendered to PDF (receipts, invoices, audit reports). |
| `CheckinPro.UnitTest` | NUnit 4 | Unit tests, referenced by CI. |

**Key packages:** EF Core SqlServer 8.0.15, Ardalis.Result 10.1.0 (+ `.AspNetCore`), Swashbuckle 8.1.1, iText 7 9.1.0 with pdfHTML, Radzen.Blazor 5.9.9, Refit 8.0.0, Blazored.LocalStorage 4.5.0.

**Dependency injection:** every repository, service and provider is registered `AddScoped` by hand in `Program.cs`. A new feature must add its lines there.

## Hosting, configuration and startup

The app is hosted on Azure App Service. CI (`.github/ci-cd.yml`) builds, tests and deploys to a `staging` slot on every push to `develop`. Non-prod hosts named in client config: `dev-nonprod-cu-lumenpms-app.azurewebsites.net` and `qa-nonprod-cu-lumenpms-app.azurewebsites.net`. Production URL: not in the repo (open question).

**Local run:** profile `https` serves `https://localhost:7020` (and `http://localhost:5063`) with `ASPNETCORE_ENVIRONMENT=Development`. Local DB is SQL Server LocalDB, database `LumenPMS_Phase2`.

**Config keys** (values deliberately left out):

| Key | Used for |
| --- | --- |
| `ConnectionStrings:DBConnectionString` | SQL Server connection for `CheckinProContext` |
| `SMTPConfiguration:SMTPHost`, `SMTPPort`, `SMTPUsername`, `SMTPPassword`, `SMTPEnableSsl` | Outgoing email (OTP, password reset), bound to `SmtpSettings` |
| `AllowedHosts` | Host filtering, currently `*` |
| Client `wwwroot/appsettings*.json`: `BaseAddress`, `BaseAddress_DEV`, `BaseAddress_QA` | Present but unused; the client builds its API URL from `HostEnvironment.BaseAddress + "api"` |

Files: `appsettings.json`, `appsettings.Development.json`, `appsettings.Staging.json`, `appsettings.Production.json`, loaded by environment name. The Production file has no connection string, so production must supply it through Azure app settings.

**Request pipeline** (`Program.cs`, in order):

1. Development or Staging: `UseWebAssemblyDebugging`, `UseSwagger`, `UseSwaggerUI` (Swagger at `/swagger`). Otherwise: `UseExceptionHandler("/Error")`, `UseHsts`.
2. `UseHttpsRedirection` → `UseRouting` → `UseCors("CorsSpecs")` → `UseAuthentication` → `UseAuthorization` → `UseStaticFiles` → `UseAntiforgery`.
3. `MapRazorComponents<App>()` with interactive WebAssembly render mode, then `MapControllers()`.

Controllers are added with `AddControllers().AddXmlSerializerFormatters()`, so the API accepts and returns XML as well as JSON.

## Authentication and authorization

The API uses one ASP.NET Core cookie scheme for staff users only. There are no API keys, no JWT, and no guest or public login. Swagger shows a Bearer/JWT box, but nothing in the server validates bearer tokens.

**Cookie** (`Program.cs`): name `AppCookies`, `SameSite=None`, expiry 30 minutes (`ExpireTimeSpan`; sliding expiration is the ASP.NET default). An unauthenticated call to an `[Authorize]` endpoint returns HTTP 401 with an empty body instead of redirecting.

**Sign-in flow** (`UserAccountController`, route prefix `/api/UserAccount`):

1. `POST SignIn` with `SignInRequestModel { EmailID, Password }`.
2. The repository loads the hash from `tblUser.Password`. `PasswordService.VerifyHashedPassword` checks it with ASP.NET Identity's `PasswordHasher<GetUserModel>`.
3. On success the server issues the cookie with these claims: `ClaimTypes.Sid` = UserID, `GivenName` = UserName, `Role` = RoleName, `Email` = EmailID, custom `IsProfileActive`. The body is `Result<bool>` = `IsPasswordChanged` (false means the user must change a temporary password).
4. `GET GetSignInUserDetail` \[Authorize\] returns `SignInUserResponseModel { UserID, HotelID, UserName, RoleName, EmailID, IsPasswordChanged, IsProfileActive, IsShiftActive, IsOwnerDashboardVisible }`.
5. `POST SignOut` \[Authorize\] deletes the cookie.

**Password recovery:** `POST ForgotPassword/{EmailID}` emails a 6-digit OTP (template `OTP` in `tblEmailTemplate`) and stores it in `tblUser.OTP`. `POST ValidateOTP { EmailID, OTP }` sets `IsOTPVerified`. `POST ResetPassword { EmailID, NewPassword, ConfirmNewPassword }` sets the new password. `POST ChangePassword` \[Authorize\] takes `{ EmailID, OldPassword, NewPassword, ConfirmNewPassword }`. New users get an 8-character random password from `PasswordService.RandomPasswordGenerator`.

**Roles** (`CommonConstants.ApplicationUserRole`): `SuperAdmin`, `HotelOwner`, `HotelManager`, `HotelStaff`. Users are linked to hotels through `tblHotelUser`.

**Authorization in practice:**

- Controllers use a plain `[Authorize]` (signed in = allowed). No endpoint uses `[Authorize(Roles = …)]` or a policy.
- `ISessionUserService` (`GetUserId`, `GetUserName`, `GetUserEmail`, `GetUserRole`, `IsProfileActive`) reads the claims. Controllers use it only to fill `AuditInfoModel` (`AuditUserID`, `AuditUserRole`) for audit columns.
- The cookie carries no HotelID claim, and controllers take `hotelID` from the URL or query. The controllers never check that it belongs to the caller; the repositories were not fully reviewed for this (open question).

**CORS** (policy `CorsSpecs`): any origin (`SetIsOriginAllowed(_ => true)`), any header, any method, `AllowCredentials()`. Any website can call the API from a browser and include the staff cookie.

**For a website integration this means:** a public website cannot call the API without holding a staff account's password, and a session with that password could read and change everything. A separate public layer with its own credentials is needed (see Recommended integration design).

## API conventions

Every endpoint lives at `/api/{Controller}/{Action}` and returns an `Ardalis.Result`, which the `[TranslateResultToActionResult]` attribute converts into an HTTP status and body.

- **Routes:** attribute routes on each action, for example `[HttpGet("GetHotelById/{hotelID}")]` under `[Route("api/[controller]")]`, giving `/api/Hotel/GetHotelById/5`. Route names are verbs (`Get…`, `AddEdit…`, `Update…`, `Delete…`), not REST resources. Some "Delete" actions are `PUT` (soft delete).
- **Parameters:** IDs in the path; filters and dates in the query string (`?hotelID=1&checkInDate=2026-10-25`); bodies as JSON on `POST`/`PUT`. `DateOnly` parameters use `yyyy-MM-dd`; `DateTime` parameters accept ISO 8601.
- **JSON:** System.Text.Json defaults, so property names are camelCase on the wire (`EmailID` → `emailID`, `HotelRoomTypeID` → `hotelRoomTypeID`). XML is also accepted and returned (`AddXmlSerializerFormatters`).
- **Success:** HTTP 200 with the value itself as the body (no envelope). Example: `GetHotelById` returns the `GetHotelModel` object. Write actions usually return `true` or nothing.
- **Failure:** the status comes from the Result: `NotFound` → 404, `Invalid` → 400, `Unauthorized` → 401, `NoContent` → 204, `Error` → the Ardalis.Result.AspNetCore default (422 Unprocessable Entity with ProblemDetails; confirm in Swagger). Error messages are generic strings such as "An error occurred while fetching hotel rooms."
- **Layer pattern:** controller action logs "Controller: X method initiated", calls `_xService.XAsync(…)`, returns `Result.Success(serviceResult)` (this passes the service's status through), and catches exceptions into `Result.Error("…")`. Services and repositories follow the same log/try/catch shape. Repositories wrap writes in `Database.BeginTransactionAsync()` and catch `DbUpdateException` separately.
- **Auditing:** write actions build `AuditInfoModel { AuditUserID, AuditUserRole }` from `ISessionUserService` and pass it down to fill audit columns and `*Audit` tables.
- **Client contract:** the Blazor client uses Refit interfaces such as `IHotelWebAppService` with `[Get("/Hotel/GetHotelById/{hotelID}")] Task<ApiResponse<GetHotelWebAppModel>>`. These are a complete, typed list of how the API is called today.

## Endpoint catalogue

The API has 124 actions across 13 controllers. All routes are under `/api/{Controller}/`. Every controller requires the staff cookie except three: `Dropdown` and `Scanner` have no `[Authorize]` at all, and in `UserAccount` only `GetSignInUserDetail`, `ChangePassword` and `SignOut` require it. In ASP.NET Core with `[ApiController]`, simple parameters bind from the route or query string and model types bind from the JSON body. ★ marks endpoints a public website would most likely need.

### HotelRoomBooking — availability, bookings, stay lifecycle

| Verb | Route | Inputs | Returns |
| --- | --- | --- | --- |
| GET | ★ `GetAvailableRoomTypes` | query `hotelID`, `checkInDate`, `checkOutDate` (DateTime) | `List<HotelRoomTypeModel>` |
| GET | ★ `GetAvailableRoomByDates` | query `hotelID`, `hotelRoomTypeID`, `checkInDate`, `checkOutDate` | `List<HotelRoomModel>` |
| GET | ★ `GetHotelDailyRateByDate` | query `hotelID`, `checkInDate` (DateOnly) | `HotelDailyRateModel` |
| GET | `GetHotelRoomsByDates` | query `hotelID`, `checkInDate`, `checkOutDate` | `List<HotelRoomModel>` |
| POST | ★ `AddHotelRoomBooking` | body `HotelRoomBookingModel` | `int` (new HotelRoomBookingID) |
| GET | `GetRoomBookingDetailsByID/{hotelRoomBookingID}` | path | `HotelRoomBookingModel` |
| PUT | `UpdateHotelRoomBooking` | body `HotelRoomBookingModel` | — |
| PUT | `UpdateHotelRoomBookingTotalAmount` | body `HotelRoomBookingRateDetailModel` | — |
| PUT | `UpdateHotelRoomBookingStatus` | body `HotelRoomBookingModel` | — |
| PUT | `RoomCheckIn/{hotelRoomBookingID}/{hotelRoomID}` | path | — |
| PUT | `RoomChange` | body `RoomChangeModel` | — |
| PUT | `RoomCheckOut` | body `UpdateHotelRoomCleaningAuditModel` | — |
| PUT | `RoomCheckOutDateChange` | body `HotelRoomBookingRateDetailModel` | — |
| PUT | `RoomExtend` | body `HotelRoomBookingModel` | — |
| PUT | `RoomCancel/{hotelRoomBookingID}` | path + query `cancellationReason` | — |
| PUT | `RoomRefund` | body `AddPaymentModel` | — |
| POST | `AddEditBookingPayment` | body `AddPaymentModel` | — |
| PUT | `AddEditMiscAmount` | body `AddEditMiscAmountModel` | — |
| GET | `GetRoomBookingMiscAmount/{hotelRoomBookingID}` | path | `List<AddEditMiscAmountModel>` |
| DELETE | `DeleteMiscAmount/{hotelRoomBookingMiscellaneousID}` | path | — |
| PUT | `RoomCleaning` | body `UpdateHotelRoomCleaningAuditModel` | — |
| GET | `GetPendingRoomCleaningList/{hotelID}` | path | `List<HotelRoomCleaningAuditModel>` |
| GET | `GetTodaysCheckOutRoomsByHotelID/{hotelID}` | path | `List<GetHotelRoomBookingModel>` |
| GET | `GetTodaysBookingsByHotelID/{hotelID}` | path | `List<GetHotelRoomBookingModel>` |
| GET | `GetBookedHotelRoomsByHotelID/{hotelID}` | path | `List<GetHotelRoomBookingModel>` |
| GET | `GetBookedRoomsByCheckOutDate` | query `hotelRoomBookingID`, `checkOutDate` | `List<GetBookedRoomDetailsModel>` |
| GET | `SearchHotelRoomBooking` | query fields of `FindHotelRoomBookingModel` | `List<GetHotelRoomBookingSearchListModel>` |
| GET | `GetMobileNumbers` | query `searchTerm` | `List<string>` |
| POST | `AddUpdateGuest` | query `hotelRoomBookingID` + body `AddGuestModel` | — |
| PUT | `UpdateGuestRequest` | body `UpdateGuestRequestModel` | — |
| PUT | `UpdateBookingReportFlag` | query `hotelRoomBookingID`, `isIncludedInReport` | — |

### Hotel — property setup, rates, rooms

| Verb | Route | Inputs | Returns |
| --- | --- | --- | --- |
| GET | ★ `GetHotelById/{hotelID}` | path | `GetHotelModel` |
| GET | `GetHotels` | — | `List<GetHotelModel>` (all hotels) |
| GET | ★ `GetHotelRoomType/{hotelID}` | path | `List<HotelRoomTypeModel>` |
| GET | `GetHotelRoomTypeById/{hotelRoomTypeID}` | path | `HotelRoomTypeModel` |
| GET | ★ `GetHotelDailyRate/{hotelID}` | path | `List<HotelDailyRateModel>` |
| GET | `GetHotelHourlyRate/{hotelID}` | path | `List<HotelHourlyRateModel>` |
| GET | ★ `GetHotelAdditionalRate/{hotelID}` | path | `List<HotelAdditionalRateModel>` |
| GET | ★ `GetHotelTaxRate/{hotelID}` | path | `List<HotelTaxRateModel>` |
| GET | ★ `GetHotelConfiguration/{hotelID}` | path | `HotelConfigurationModel` |
| GET | `HotelRoom/GetHotelRooms/{hotelID}` | path | `List<HotelRoomModel>` |
| GET | `HotelRoom/GetHotelRoomAllDetails/{hotelID}` | path | `List<HotelRoomDetailModel>` |
| GET | `HotelRoom/GetHotelRoomById/{hotelRoomID}` | path | `HotelRoomModel` |
| GET | `GetHotelProfileCompletionStatus/{hotelId}` | path | `HotelProfileStatusModel` |
| GET | `GetHotelExpense/{hotelID}` | path | `List<HotelExpenseModel>` |
| GET | `GetDirectBillingCompany/{hotelID}` | path | `List<DirectBillingCompanyModel>` |
| POST | `AddHotel` | body `AddHotelModel` | — |
| PUT | `ActiveInactiveHotel/{hotelID}`, `ActiveInactiveOwnerDashboard/{hotelID}` | path + query `isActive` | — |
| POST | `AddEditHotelTaxRate`, `AddEditHotelConfiguration`, `AddEditHotelDailyRate`, `AddEditHotelHourlyRate`, `AddEditHotelRoomType`, `AddEditHotelAdditionalRate` | body: matching `…Model` | — |
| DELETE | `DeleteHotelDailyRate/{hotelDailyRateID}` | path | — |
| POST | `HotelRoom/AddEditHotelRoom` | body `AddEditHotelRoomModel` | — |
| PUT | `HotelRoom/UpdateHotelRoom/{hotelRoomID}` | path + query `RoomStatus` | — |
| PUT | `HotelRoom/DeleteHotelRoom/{hotelRoomID}` | path | — |
| POST / PUT / DELETE | `AddHotelExpense`, `UpdateHotelExpense`, `DeleteHotelExpense/{hotelExpenseID}` | body `HotelExpenseModel` / path | — |
| POST | `AddUpdateDirectBillingCompany` | body `DirectBillingCompanyModel` | — |

### Guest

| Verb | Route | Inputs | Returns |
| --- | --- | --- | --- |
| GET | `GetGuests` | query `hotelID` | `List<GetGuestModel>` |
| GET | `GetGuestById/{guestID}` | path | `List<GetGuestModel>` |
| GET | `GetGuestByCodeOrIdentityNumberOrMobile` | query `guestCode`, `identityNumber`, `mobileNumber` (any) | `GetGuestModel` |
| GET | `GetGuestByMobile` | query `mobileNumber` | `GetGuestModel` |
| GET | `GetGuestByName` | query `firstName`, `lastName` | `List<GetGuestModel>` |
| GET | `GetGuestRewardPoint` | query `hotelID`, `guestID` | `GuestRewardModel` |

### Dashboard

| Verb | Route | Inputs | Returns |
| --- | --- | --- | --- |
| GET | `GetDashboard/{hotelID}` | path | `GetDashboardModel` |
| GET | `GetHotelShiftDetail/{hotelID}` | path | `HotelShiftModel` |
| GET | `GetHotelShiftDetailByDate` | query `hotelId`, `fromDate`, `toDate` (DateOnly) | `List<HotelShiftModel>` |
| POST / PUT | `StartHotelShift`, `EndHotelShift` | body `HotelShiftModel` | — |
| GET | `GetHotelMetricsByDateRange` | query `hotelId`, `selectedDate`, `metrix` | `List<GetHotelOwnerDashboardModel>` |
| GET | `GetHotelRoomRevenueByYear` | query `hotelId`, `year` | `List<GetHotelRoomRevenueModel>` |

### HotelReport — PDFs (body is `byte[]`)

| Verb | Route | Inputs |
| --- | --- | --- |
| GET | `PrintBookingReceipt/{hotelRoomBookingID}`, `DownloadBookingInvoice/{hotelRoomBookingID}` | path |
| GET | `DownloadDailyAuditReport`, `DownloadRoomTaxCollectedReport`, `DownloadSummaryIncomeReport`, `DownloadRoomRevenueReport`, `DownloadIncomeBreakdownReport` | query `hotelId`, `fromDate`, `toDate` |
| GET | `DownloadShiftReport` | query `hotelId`, `fromDate`, `toDate` + `HotelShiftModel` fields |

### Lookups and admin

| Controller | Endpoints |
| --- | --- |
| `Dropdown` (no auth) | GET `GetRolesForDropdown`, `GetCountriesForDropdown`, `GetStatesForDropdown/{countryID}`, `GetHotelRoomTypesForDropdown/{hotelID}`, `GetRoomStatusesForDropdown` → `List<SelectionItemModel>` |
| `Country` | GET `GetCountries`, `GetCountryById/{countryId}`; POST `AddCountry`; PUT `UpdateCountry/{countryId}`, `DeleteCountry/{countryId}` (`CountryModel`) |
| `State` | GET `GetStatesByCountryId/{countryId}`, `GetActiveStatesByCountryId/{countryId}`, `GetStatesByStateId/{stateId}`; POST `AddState`; PUT `UpdateState/{stateId}`, `DeleteState/{stateId}` (`StateModel`) |
| `RoomStatus` | GET `GetRoomStatuses`, `GetRoomStatusById/{RoomStatusID}`; POST `AddRoomStatus`; PUT `UpdateRoomStatus/{RoomStatusID}`, `DeleteRoomStatus/{RoomStatusID}` |
| `Role` | GET `GetRoles`, `GetRoleById/{roleId}`; PUT `UpdateRole/{roleId}` (`RoleModel`) |
| `User` | GET `GetUsers/{hotelID}`, `GetUserById` (current user); POST `AddUser`; PUT `UpdateUser`, `BlockUser/{userID}`, `ActivateUser/{userID}`; DELETE `DeleteUser/{userID}` |
| `UserAccount` | See Authentication: `SignIn`, `GetSignInUserDetail`, `ChangePassword`, `ForgotPassword/{EmailID}`, `ValidateOTP`, `ResetPassword`, `SignOut` |
| `Scanner` (no auth) | GET `/api/Scanner/GetGuestScanDetail?hotelID=` → `List<AddGuestModel>`; POST `/GuestScanDetail/{hotelId:Guid}` (note: outside `/api`) with any JSON body, stored raw in `tblGuestIDScan` against `tblHotel` unique ID |

## Core data models

These are the API DTOs in `CheckinPro.WebApi.Models` that a hotel website touches. Field names are exact (C# PascalCase; JSON is camelCase). `?` means nullable. None of these DTOs carry validation attributes; validation happens only in the Blazor UI.

| Model | Fields |
| --- | --- |
| `GetHotelModel` | `int HotelID`, `string? HotelCode`, `Guid? HotelUniqueID`, `string? BusinessLLCName`, `Email`, `MobileNumber`, `Address1`, `Address2`, `int? StateID`, `City`, `ZipCode`, `Website`, `decimal? TaxRate`, `Description`, `bool IsOwnerDashboardVisible`, `bool IsHotelActive`, `HotelOwnerModel? hotelOwner { FullName, EmailID, MobileNumber }` |
| `HotelRoomTypeModel` | `int HotelRoomTypeID`, `int HotelID`, `string? RoomTypeName`, `Description`, `RoomTypeIcon`, `decimal? AdjustmentRate`, `bool IsHotelRoomTypeActive`, `int NumberOfRoomsAvailable`, `int PendingRoomCleaning`, `int BookedRoom`, `GetHotelModel Hotel` |
| `HotelRoomModel` | `int HotelRoomID`, `int HotelID`, `int HotelRoomTypeID`, `string? RoomNumber`, `int? Floor`, `int? MaxOccupancy`, `string? RoomStatus`, `Description`, `bool IsHotelRoomActive`, `bool IsHotelRoomDeleted`, `HotelRoomType`, `HotelRoomBookings` |
| `HotelConfigurationModel` | `int HotelMasterConfigurationID`, `int HotelID`, `decimal? BestAvailableRate` (default nightly base rate), `decimal? CashDrawerAmount` |
| `HotelDailyRateModel` | `int HotelDailyRateID`, `int HotelID`, `DateOnly? DailyRateDate`, `DateOnly? StartDate`, `DateOnly? EndDate`, `decimal? DailyBestAvailableRate` (per-date override), `bool IsDailyRateActive` |
| `HotelHourlyRateModel` | `int HotelHourlyRateID`, `int HotelID`, `int? Hour`, `decimal? HourlyRate` (price for a stay of exactly `Hour` hours), `bool IsHotelHourlyRateActive` |
| `HotelAdditionalRateModel` | `int HotelAdditionalRateID`, `int HotelID`, `string? AdditionalRateName`, `decimal? AdditionalRate` (a percent), `bool IsDiscountedRate` (true = discount, false = surcharge), `bool IsAdditionalRateActive` |
| `HotelTaxRateModel` | `int HotelTaxRateID`, `int HotelID`, `string? TaxName`, `decimal? TaxRate` (a percent), `bool IsTaxRateActive` |
| `HotelRoomBookingModel` (create/read booking) | `int HotelRoomBookingID`, `int HotelRoomTypeID`, `int? HotelRoomID`, `string? BookingCode`, `DateTime? ScheduledCheckInDate`, `ScheduledCheckOutDate`, `int? Duration`, `DateTime? ActualCheckInDate`, `ActualCheckOutDate`, `int? NumberOfGuests`, `bool IsHourlyBooking`, `string? BookingStatus`, `GuestSpecialRequests`, `GuestNoteType`, `GuestNotes`, `bool IsBookingCancelled`, `CancellationReason`, `bool IsIncludedInReport`, `List<AddGuestModel> Guests`, `AddEditHotelRoomModel HotelRoom`, `HotelRoomTypeModel HotelRoomType`, `HotelRoomBookingAudits`, `ICollection<HotelRoomBookingRateDetailModel> HotelRoomBookingRateDetails`, `ICollection<HotelRoomBookingTaxRateModel> HotelRoomBookingTaxRates`, `ICollection<AddPaymentModel> HotelRoomPayments`. It has no `HotelID`; the hotel is implied by the room type. |
| `HotelRoomBookingRateDetailModel` (the price) | `HotelRoomBookingRateDetailID`, `HotelRoomBookingID`, `CheckInDate`, `CheckOutDate`, `Duration`, `BestAvailableRate`, `AdjustmentRate`, `HourlyRate`, `RoomChargeAmount` (pre-tax), `TotalAmount` (with tax), `IsDiscountedRate`, `AdditionalRateType`, `AdditionalRateAmount`, `DiscountedAmount`, `MiscellaneousAmount`, `FinalAmount`, `Balance`, `IsExtend`, `int? TaxStatus` (0 non-taxable, 1 taxable, 2 partial), `IsBookingActive`, audit fields |
| `HotelRoomBookingTaxRateModel` | `HotelRoomBookingTaxRateID`, `HotelRoomBookingID`, `int? HotelTaxRateID`, `BookingTaxRateName`, `BookingTaxRatePercentage`, `BookingTaxRate` (amount), `IsBookingTaxRateActive` |
| `AddGuestModel` | `int GuestID`, `string? GuestCode`, `string FirstName`, `string LastName`, `MobileNumber` (UI format `+1 (941) 875-1311`), `IdentityType` (Passport, Driver's License, State ID, Mexican ID), `IdentityNumber`, `FrontSideImage` (base64 JPEG), `Email`, `Address1`, `Address2`, `Country`, `State`, `City`, `ZipCode`, `int? ScanID`, `bool? IsGuestScanned`, `ProfilePicture`, `bool IsPrimaryGuest` |
| `AddPaymentModel` | `int PaymentID`, `int HotelRoomBookingID`, `DateTime? PaymentDate`, `PaymentCompletedOn`, `decimal? Amount`, `decimal? UsedRewardPoint`, `string? PaymentMode`, `PaymentType`, `PaymentStatus`, `PaymentGateway`, `TransactionID`, `bool IsRefunded`, `decimal? RefundAmount`, `DateTime? RefundDate`, `PaymentNotes`, `RefundNotes` |
| `GuestRewardModel` | `GuestRewardID`, `GuestID`, `HotelID`, `decimal? TotalRewardPoint` |
| `SelectionItemModel` (dropdowns) | `ItemID`, `ItemName`, `ItemIcon` |

**Fixed value lists** (`CommonConstants`, stored as strings):

| List | Values |
| --- | --- |
| Booking status | `Booked`, `CheckedIn`, `CheckedOut`, `Cancelled`, `No Show`, `OverDue`, `Extend` |
| Room status | `Ready to CheckIn`, `Pending Cleaning`, `Booked`, `In Progress`, `Maintenance`, `Out of Service` |
| Payment status | `Completed`, `Pending`, `Paid`, `Failed`, `Refunded`, `Partially Paid` |
| Payment mode | `Credit Card`, `Debit Card`, `Cash`, `Bank Transfer`, `Check`, `Online Pay`, `Hospitality Adjustment`, `CashApp`, `Zelle`, `Venmo`, `Reward Point` |
| Payment type | `Booking Payment`, `Miscellaneous Amount` (refunds use `Payment` / `Refund`) |
| Payment gateway | `Visa`, `MasterCard`, `American Express`, `PayPal`, `Apple Pay`, `Google Pay`, `Discover` — labels only. Staff record payments taken elsewhere; no payment processor is integrated in the code. |

## Booking lifecycle and business rules

The price is calculated in the Blazor UI (`Pages/Hotel/HotelRoomBooking/RoomBooking.razor.cs`). The server stores whatever amounts it receives. A public booking flow must therefore re-implement this calculation on the server.

**Booking statuses** (`tblHotelRoomBooking.BookingStatus`) and the room status they set (`tblHotelRoom.RoomStatus`):

| Action (endpoint) | Booking status | Room status | Notes |
| --- | --- | --- | --- |
| Create (`AddHotelRoomBooking`) | `Booked` | unchanged | Room is optional. If a room is given and check-in is today, the server immediately runs check-in. |
| Check in (`RoomCheckIn`) | `Booked` → `CheckedIn` | → `Booked` | Sets `ActualCheckInDate`. |
| Check out (`RoomCheckOut`) | `CheckedIn` → `CheckedOut` | → `Pending Cleaning` | Sets `ActualCheckOutDate`, adds a `tblHotelRoomCleaningAudit` row, adds `EarnedRewardPoint` (sent by the UI) to `tblGuestReward` and `tblGuestRewardHistory`. |
| Clean (`RoomCleaning`) | — | `Pending Cleaning` → `Ready to CheckIn` | Skipped if the room is `Out of Service`. |
| Cancel (`RoomCancel`) | → `Cancelled` | room released | Sets `IsBookingCancelled`, `CancellationReason`. |
| Extend, change date, change room (`RoomExtend`, `RoomCheckOutDateChange`, `RoomChange`) | unchanged | old room → `Pending Cleaning` on room change | Adds rate-detail rows with `IsExtend`. |

**Dates and times** (server local time, `DateTime.Now`, no time zones):

- Nightly stays: check-in 11:00 on the arrival date, check-out 11:00 on the departure date. Before 06:00 the UI treats "today" as the previous day.
- Nights = `floor((checkOut.Date − checkIn.Date).TotalDays)`, minimum 1.
- Hourly stays (`IsHourlyBooking = true`): check-out = check-in + N hours, price = the `HotelHourlyRate` row whose `Hour` = N.

**Nightly price** (UI formula):

1. Base rate = `HotelDailyRate.DailyBestAvailableRate` for the check-in date if one exists and is not 0, otherwise `HotelConfiguration.BestAvailableRate`. The rate for the check-in date applies to every night.
2. Nightly rate = base rate + room type `AdjustmentRate` (a flat amount, not a percent).
3. `RoomChargeAmount` = nightly rate × nights.
4. For each active tax, `BookingTaxRate` = `RoomChargeAmount` × `TaxRate` / 100. `TotalAmount` = round(`RoomChargeAmount` + taxes, 2).
5. Optional additional rate (staff pick one): `FinalAmount` = `TotalAmount` × (1 − pct/100) if `IsDiscountedRate`, else × (1 + pct/100). Never below 0. Staff can also overwrite `FinalAmount` by hand.
6. `Balance` = `FinalAmount` − sum of payments with status `Completed`. `TaxStatus` = 0 if no taxes chosen, 1 if all, 2 if some.

**Hourly price:** the hourly rate already includes tax. `RoomChargeAmount` = hourly rate ÷ (1 + total tax % / 100), and the tax lines are derived from that.

**Availability rules today:**

- `GetAvailableRoomTypes` returns, per active room type with rooms: `NumberOfRoomsAvailable` = rooms that are active, not deleted and currently `Ready to CheckIn` (not date-aware), `PendingRoomCleaning`, and `BookedRoom` = bookings of that type with status `Booked` overlapping the dates.
- `GetAvailableRoomByDates` returns `Ready to CheckIn` rooms of a type with no overlapping `CheckedIn` booking.
- Overlap test used everywhere: a booking overlaps when `checkIn < booking.ScheduledCheckOutDate` and `checkOut > booking.ScheduledCheckInDate`.
- `AddHotelRoomBooking` does not re-check availability, so two simultaneous requests can over-book a room type.

**What `AddHotelRoomBooking` does** (`HotelRoomBookingRepository.cs`, inside one transaction):

1. Rejects with 204 if `Guests` is empty.
2. Gets a booking code from `sp_GenerateUniqueBookingNumber` (6 characters: 2 letters + 4 digits, for example `KQ4821`).
3. Inserts `tblHotelRoomBooking` (`Booked`, `IsIncludedInReport = true`), then the rate details, the tax rows and the payment rows exactly as sent.
4. For each guest, finds an existing `tblGuest` by `IdentityNumber` only and overwrites its fields, or creates a new guest. Links guests through `tblHotelRoomBookingGuest` (`IsPrimaryGuest`).
5. If a payment uses `Reward Point`, subtracts `UsedRewardPoint` from the primary guest's `tblGuestReward` for that hotel.
6. Writes a `tblHotelRoomBookingAudit` row "Booked" and returns the new `HotelRoomBookingID`.

For a website, step 4 is dangerous: a guest with no ID number (`null`) matches the first existing guest whose ID number is also null, and overwrites that person's name, phone and email.

## Database

The database is SQL Server (local name `LumenPMS_Phase2`, dev name `CheckinPro_Dev`), used database-first. The EF Core model in `CheckinPro.DAL.SQL/CheckinProDBContext` is scaffolded from the live database with `Scaffold-DbContext … -UseDatabaseNames -Context CheckinProContext`, so entity and column names match the tables exactly. The `.sqlproj` was last changed in January 2026 and the EF model in April 2026; where they differ (for example `tblHotel.Address1/Address2` exist only in EF), trust the EF model.

There are no EF migrations. Schema changes are made in SQL Server first, then the context is re-scaffolded. Every table has `CreatedBy/CreatedDate/UpdatedBy/UpdatedDate`, and most have `DeletedBy/DeletedDate` plus `Is…Active` / `Is…Deleted` flags for soft delete.

**Tables a website integration touches:**

| Table | Key columns | Links to |
| --- | --- | --- |
| `tblHotel` | `HotelID`, `HotelCode`, `HotelUniqueID` (GUID), `BusinessLLCName`, `Email`, `MobileNumber`, `Address1`, `Address2`, `StateID`, `City`, `ZipCode`, `Website`, `Description`, `IsHotelVerified`, `IsHotelActive`, `IsHotelBlocked`, `IsHotelDeleted` | `tblState` |
| `tblHotelConfiguration` | `HotelMasterConfigurationID`, `HotelID`, `BestAvailableRate`, `CashDrawerAmount` | `tblHotel` |
| `tblHotelRoomType` | `HotelRoomTypeID`, `HotelID`, `RoomTypeName`, `Description`, `RoomTypeIcon`, `AdjustmentRate`, `IsHotelRoomTypeActive` | `tblHotel` |
| `tblHotelRoom` | `HotelRoomID`, `HotelID`, `HotelRoomTypeID`, `RoomNumber`, `Floor`, `MaxOccupancy`, `RoomStatus`, `IsHotelRoomActive`, `IsHotelRoomDeleted` | `tblHotel`, `tblHotelRoomType` |
| `tblHotelDailyRate` | `HotelDailyRateID`, `HotelID`, `DailyRateDate`, `DailyBestAvailableRate`, `IsDailyRateActive` (one row per date) | `tblHotel` |
| `tblHotelHourlyRate` | `HotelHourlyRateID`, `HotelID`, `Hour`, `HourlyRate`, `IsHotelHourlyRateActive` | `tblHotel` |
| `tblHotelAdditionalRate` | `HotelAdditionalRateID`, `HotelID`, `AdditionalRateName`, `AdditionalRate`, `IsDiscountedRate`, `IsAdditionalRateActive` | `tblHotel` |
| `tblHotelTaxRate` | `HotelTaxRateID`, `HotelID`, `TaxName`, `TaxRate`, `IsTaxRateActive` | `tblHotel` |
| `tblHotelRoomBooking` | `HotelRoomBookingID`, `HotelRoomTypeID`, `HotelRoomID` (nullable until check-in), `BookingCode`, `ScheduledCheckInDate`, `ScheduledCheckOutDate`, `Duration`, `ActualCheckInDate`, `ActualCheckOutDate`, `NumberOfGuests`, `IsHourlyBooking`, `BookingStatus`, `GuestSpecialRequests`, `GuestNoteType`, `GuestNotes`, `IsBookingCancelled`, `CancellationReason`, `IsIncludedInReport` | `tblHotelRoomType`, `tblHotelRoom` (no direct `HotelID`) |
| `tblHotelRoomBookingRateDetail` | price breakdown, one row per booking plus one per extension (same columns as `HotelRoomBookingRateDetailModel`) | `tblHotelRoomBooking` |
| `tblHotelRoomBookingTaxRate` | `HotelRoomBookingRateDetailID`, `HotelTaxRateID`, `BookingTaxRateName`, `BookingTaxRatePercentage`, `BookingTaxRate` | booking, rate detail, `tblHotelTaxRate` |
| `tblHotelRoomBookingGuest` | `HotelRoomBookingGuestID`, `HotelRoomBookingID`, `GuestID`, `IsPrimaryGuest` | `tblGuest`, `tblHotelRoomBooking` |
| `tblGuest` | `GuestID`, `GuestCode`, `FirstName`, `LastName`, `FullName`, `MobileNumber`, `IdentityType`, `IdentityNumber`, `FrontSideImage` (bytes), `Email`, address fields, `ScanID`, `IsGuestScanned`, `ProfilePicture`, plus unused login columns `Password`, `IsPasswordChanged`, `IsProfileActive`, `IsProfileBlocked`, `IsProfileDeleted`, `LastLoginDate` | — (guests are shared across hotels) |
| `tblGuestReward` / `tblGuestRewardHistory` | `GuestID`, `HotelID`, `TotalRewardPoint` / `HotelRoomBookingGuestID`, `EarnedRewardPoint` | — |
| `tblPayment` | `PaymentID`, `HotelRoomBookingID`, `PaymentDate`, `Amount`, `UsedRewardPoint`, `PaymentMode`, `PaymentType`, `PaymentStatus`, `PaymentGateway`, `TransactionID`, `TransactionType`, `IsRefunded`, `RefundDate`, `RefundAmount`, `RefundNotes`, `PaymentCompletedOn` | `tblHotelRoomBooking` |
| `tblHotelRoomBookingAudit` | `HotelRoomBookingID`, `ActionName`, `ActionDateTime`, `ActionBy`, `ActionComment` | `tblHotelRoomBooking` |
| `tblEmailTemplate` | `EmailTemplateName`, `EmailTemplateSubject`, `EmailTemplateDesign` (HTML with `[OTP]`-style placeholders) | — |

**Other tables:** `tblUser`, `tblRole`, `tblHotelUser` (staff and their hotels), `tblHotelShift`, `tblHotelExpense`, `tblHotelDirectBillingCompany`, `tblHotelRoomBookingMiscDetail`, `tblHotelRoomCleaningAudit`, `tblGuestFeedback` (`GuestID`, `HotelID`, `Rating`, `Feedback`), `tblGuestIDScan`, `tblGuestIDScanAudit`, `tblCountry`, `tblState`, `tblRoomStatus`.

**Stored procedures:** `sp_GenerateUniqueBookingNumber` (output `@BookingNumber`, 6 characters), `sp_FindHotelRoomBooking` (search), `sp_GetHotelMetricsByDateRange`, `sp_GETHotelRoomRevenueByYear`, `sp_DeleteHotelRoomBooking`. The search, metrics and revenue procedures map to keyless `DbSet`s on `CheckinProContext`.

## Security findings

The first item lets anyone take over any staff account today and should be fixed before any website work. None of the items below were tested against a running server; they come from reading the code.

| # | Severity | Finding | Where | Fix |
| --- | --- | --- | --- | --- |
| 1 | Critical | `POST /api/UserAccount/ResetPassword` needs no login and never checks `IsOTPVerified` or the OTP, so anyone who knows a staff email can set that account's password. | `UserAccountController.ResetPassword`, `UserAccountRepository.ResetPassword` | Require a verified, unexpired OTP for that email, then clear `OTP`/`IsOTPVerified` after use. |
| 2 | High | OTPs never expire, have no attempt limit and come from `System.Random`. A 6-digit code can be guessed. | `UserAccountRepository.ForgotPassword`, `ValidateOTP` | Add an expiry column, an attempt counter or rate limit, and use `RandomNumberGenerator`. |
| 3 | High | Secrets are committed to git: the Gmail SMTP password in `appsettings.Development.json`, `.Staging.json` and `.Production.json`, and SQL Server logins for a public-IP server in `CheckinPro.DAL.SQL/CheckinPro_ScaffoldCommands.txt`. | those files | Rotate the passwords, move them to Azure App Settings or Key Vault and user-secrets, and purge them from git history. |
| 4 | High | Two endpoints need no login: `GET /api/Scanner/GetGuestScanDetail?hotelID=` returns guests' ID-scan data for any hotel, and `POST /GuestScanDetail/{hotelId}` accepts any JSON into `tblGuestIDScan`. | `ScannerController` | Put `[Authorize]` on the GET; protect the POST with a per-device secret. |
| 5 | High | No tenant checks in the controllers: any signed-in user of one hotel can pass another `hotelID` or booking ID (for example `GetGuests`, `GetDashboard`, reports). `GetHotels` and `GetMobileNumbers` return data for all hotels. | all controllers | Put the user's hotel IDs in claims and check every `hotelID` and record against them (a policy or filter). |
| 6 | Medium | CORS allows any origin with credentials, and the cookie is `SameSite=None`. Any website a staff member visits could call the API as them. | `Program.cs` `CorsSpecs`, cookie options | List allowed origins explicitly; use `SameSite=Lax` or `Strict` and `Secure`. |
| 7 | Medium | Roles are never enforced. Every signed-in user, including `HotelStaff`, can call admin actions such as `AddHotel`, `AddUser`, `UpdateRole` and the tax and rate edits. | all controllers | `[Authorize(Roles = …)]` or policies per action. |
| 8 | Medium | Prices, taxes and payments are trusted from the request, and availability isn't re-checked on booking. | `AddHotelRoomBooking` | Server-side pricing and an availability check inside the transaction. |
| 9 | Medium | Guest matching by `IdentityNumber` alone, including `null`, overwrites existing guest records. | `AddHotelRoomBooking` guest loop | Match on a non-null ID plus another field; never match null. |
| 10 | Low | `AllowedHosts: *`, Swagger enabled on Staging, and generic errors that hide nothing but give no correlation ID. | `appsettings*.json`, `Program.cs` | Restrict hosts; protect Swagger on Staging. |

The recommended design below keeps the website away from all of these endpoints. Fixing items 1–4 is still needed regardless.

## Recommended integration design

Add a small, separate public API inside `CheckinPro.WebApp` for websites, versioned under `/api/public/v1`, and keep every existing staff endpoint closed to it. Each hotel is addressed by its `HotelUniqueID` GUID (not the guessable integer `HotelID`) and authenticated with a per-hotel API key. The server computes all prices and re-checks availability.

**Endpoints:**

| Verb | Route | Purpose | Response |
| --- | --- | --- | --- |
| GET | `/api/public/v1/hotels/{hotelUniqueId}` | Public hotel profile | name (`BusinessLLCName`), address, phone, email, website, description |
| GET | `/api/public/v1/hotels/{hotelUniqueId}/room-types` | Room types for display | `[{ roomTypeId, name, description, icon, maxOccupancy }]` (max of its rooms' `MaxOccupancy`) |
| GET | `/api/public/v1/hotels/{hotelUniqueId}/availability?checkIn=yyyy-MM-dd&checkOut=yyyy-MM-dd&guests=n` | Date-aware availability with quotes | `[{ roomTypeId, name, roomsLeft, nights, nightlyRate, roomCharge, taxes:[{name, percent, amount}], total, currency:"USD" }]` |
| POST | `/api/public/v1/hotels/{hotelUniqueId}/bookings` | Create a booking request | `201 { bookingCode, status, checkIn, checkOut, roomType, total }` |
| GET | `/api/public/v1/hotels/{hotelUniqueId}/bookings/{bookingCode}?lastName=` | Guest looks up their booking | status, dates, room type, total, balance |
| POST | `/api/public/v1/hotels/{hotelUniqueId}/bookings/{bookingCode}/cancel` | Optional guest cancellation, body `{ lastName, reason }` | `200` |

**Booking request body:** `{ roomTypeId, checkIn, checkOut, numberOfGuests, guest: { firstName, lastName, email, mobileNumber }, specialRequests, quotedTotal, idempotencyKey }`. The server recomputes the price; if it differs from `quotedTotal`, return 409 with the new quote. No ID number, ID image or card data is accepted from the website.

**Rules the new code must follow:**

- Nightly stays only to start (`IsHourlyBooking = false`); check-in and check-out at 11:00 hotel-local time.
- Price = the Booking lifecycle formula: base rate from `tblHotelDailyRate` (per night, falling back to `tblHotelConfiguration.BestAvailableRate`) + room type `AdjustmentRate`, times nights, plus every active `tblHotelTaxRate`. No additional rates or discounts from the website. Decide whether each night uses its own daily rate or, like the UI, the check-in date's rate (open question).
- Rooms left per type = active, non-deleted rooms of that type (any status except `Out of Service` and `Maintenance`) minus bookings of that type with status `Booked`, `CheckedIn` or `Extend` that overlap the dates. Re-check inside the booking transaction with `IsolationLevel.Serializable` or an app lock, so two requests can't take the last room.
- Insert with `HotelRoomID = null`, `BookingStatus = Booked`, `NumberOfGuests`, `GuestSpecialRequests`, `GuestNoteType = "Website"`, plus one `tblHotelRoomBookingRateDetail` row with `TaxStatus = 1`, `Balance = FinalAmount`, the matching `tblHotelRoomBookingTaxRate` rows, no `tblPayment` rows, and a `tblHotelRoomBookingAudit` row with `ActionBy = "Website"`. Use `sp_GenerateUniqueBookingNumber` for the code.
- Guests: match an existing `tblGuest` only on exact email plus mobile number; otherwise create a new one. Never copy website input over an existing guest. Staff complete ID details at check-in in the existing UI.
- `CreatedBy`: use a dedicated system user (for example a `tblUser` row named "Website") so audit columns stay valid.
- Email the guest a confirmation through the existing SMTP settings and a new `tblEmailTemplate` row (for example `BookingConfirmation`).

**Security for the public layer:**

- New table `tblHotelApiKey (HotelApiKeyID, HotelID, KeyHash, KeyPrefix, AllowedOrigins, IsActive, CreatedDate, LastUsedDate, RevokedDate)`. Store only a SHA-256 hash; send the key as header `X-Api-Key`. Implement an `AuthenticationHandler` named `PublicApiKey`, and give the public controller `[Authorize(AuthenticationSchemes = "PublicApiKey")]`, checking that the key's hotel matches `{hotelUniqueId}`.
- If the website calls from the browser, the key is visible, so treat it as a publishable key: lock it to `AllowedOrigins`, keep it read-and-book only, and rate-limit. Better: the website's own server (or a serverless function) calls LumenPMS, and the browser calls the website.
- A separate CORS policy (for example `PublicWebsite`) with explicit origins and no credentials, applied only to the public controller with `[EnableCors]`. Fix the global `CorsSpecs` policy separately.
- `builder.Services.AddRateLimiter` (.NET 8 built-in): for example 60 reads per minute per key and 5 bookings per hour per IP, plus a CAPTCHA or honeypot on the website form.
- Return only the fields listed above. No guest lists, staff data or internal IDs other than `roomTypeId`.

**Implementation steps in this codebase:**

1. Fix security findings 1–4 first.
2. Add `tblHotelApiKey` and the confirmation email template in SQL Server, then re-scaffold `CheckinProContext` with the command in `CheckinPro_ScaffoldCommands.txt` (credentials moved out of that file first).
3. Add DTOs under `CheckinPro.WebApi.Models/PublicModels/` (`PublicHotelModel`, `PublicRoomTypeModel`, `PublicAvailabilityModel`, `PublicBookingRequestModel`, `PublicBookingResponseModel`).
4. Add `IPublicBookingRepository` / `PublicBookingRepository` (availability, pricing, insert in one transaction) and `IPublicBookingService` / `PublicBookingService`, following the existing log/try/catch and `Ardalis.Result` pattern. Put the pricing in one shared class (for example `BookingPriceCalculator` in `CheckinPro.Repositories`) so the staff UI can move to it later.
5. Add `Providers/ApiKeyAuthenticationHandler.cs`, register the scheme next to the cookie in `Program.cs`, add the `PublicWebsite` CORS policy and the rate limiter, and register the new services with `AddScoped`.
6. Add `Controllers/PublicController.cs` with `[Route("api/public/v1/hotels/{hotelUniqueId:guid}")]`, `[TranslateResultToActionResult]`, `[ApiController]`.
7. Add a staff screen (Blazor, `Pages/Hotel/`) for owners to create and revoke API keys, and add "Website" bookings to the staff booking list (they already appear, because they are normal `Booked` rows).
8. NUnit tests in `CheckinPro.UnitTest` for pricing, availability overlap and over-booking.

## Open questions

Answer these before building; each changes the design above.

- [ ] What is the website, and where is it hosted? Does it have a server side that can keep an API key secret?
- [ ] Show rooms and prices only, or take bookings too? Hourly stays on the website, or nightly only?
- [ ] Should a website booking be confirmed at once (`Booked`) or wait for staff approval (needs a new status such as `Pending`)?
- [ ] Payment: pay at the hotel, a deposit, or full prepayment? If online, which processor (no processor is integrated today)?
- [ ] Pricing across a multi-night stay: each night's own daily rate, or the check-in date's rate for every night as the UI does now?
- [ ] Cancellation policy for website bookings, and can guests cancel themselves?
- [ ] Hotel time zone(s): the server uses `DateTime.Now`; what time zone does the Azure App Service run in?
- [ ] Production URL and environment of LumenPMS, and is the website for one hotel or many?
- [ ] Do the repositories check that a `hotelID` belongs to the signed-in user anywhere? (Not seen in controllers; repositories not fully reviewed.)
- [ ] Should guests get website accounts? `tblGuest` already has unused `Password`, `IsProfileActive` and `LastLoginDate` columns.
